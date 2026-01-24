// server/index.js
// Jeopardy Server - MIT SPECTATOR/ONLINE-MODUS SUPPORT

const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const path = require("path");

const app = express();
const server = http.createServer(app);
const io = new Server(server);

const HOST_PASSWORD = "baman187";

// -----------------------------
// Static Files aus /public
// -----------------------------
const publicPath = path.join(__dirname, "..", "public");
app.use(express.static(publicPath));
app.get("/", (req, res) => res.sendFile(path.join(publicPath, "index.html")));

// -----------------------------
// Game-Logik
// -----------------------------
const games = {};

function createRoomCode() {
  return Math.random().toString(36).substring(2, 7).toUpperCase();
}

function normRoomCode(roomCode) {
  return String(roomCode || "").trim().toUpperCase();
}

function playerKeyFromName(name) {
  return String(name || "").trim().toLowerCase();
}

function emitPlayers(roomCode) {
  const game = games[roomCode];
  if (!game) return;
  io.to(roomCode).emit("players-updated", game.players);
}

function ensureLockedPlayers(game) {
  if (!game.lockedPlayers || !(game.lockedPlayers instanceof Set)) {
    game.lockedPlayers = new Set();
  }
}

function ensureSpectators(game) {
  if (!game.spectators || !(game.spectators instanceof Set)) {
    game.spectators = new Set();
  }
}

io.on("connection", (socket) => {
  console.log("Client verbunden:", socket.id);

  // --------------------------------
  // Host erstellt ein Spiel
  // --------------------------------
  socket.on("host-create-game", ({ password } = {}, callback) => {
    if (password !== HOST_PASSWORD) {
      return callback?.({ success: false, error: "Falsches Passwort" });
    }

    const roomCode = createRoomCode();

    games[roomCode] = {
      hostId: socket.id,
      players: {},
      socketToPlayerId: {},
      buzzingEnabled: false,
      firstBuzzId: null,
      lockedPlayers: new Set(),
      spectators: new Set(),
      estimateRound: null,
      currentRound: 1,
      currentQuestion: null, // Für Late-Joiner
    };

    socket.join(roomCode);
    console.log("Game erstellt:", roomCode);
    callback?.({ success: true, roomCode });
  });

  // --------------------------------
  // Spieler joint / re-joint
  // --------------------------------
  socket.on("player-join", ({ roomCode, name }, callback) => {
    const rc = normRoomCode(roomCode);
    const game = games[rc];

    if (!game) return callback?.({ success: false, error: "Room nicht gefunden" });

    ensureLockedPlayers(game);
    ensureSpectators(game);

    const cleanName = String(name || "").trim();
    if (!cleanName) return callback?.({ success: false, error: "Bitte einen Namen eingeben" });

    const playerId = playerKeyFromName(cleanName);

    // Reconnect: Score behalten
    if (game.players[playerId]) {
      const prevSocketId = game.players[playerId].socketId;
      if (prevSocketId && game.socketToPlayerId[prevSocketId] === playerId) {
        delete game.socketToPlayerId[prevSocketId];
      }
      game.players[playerId].connected = true;
      game.players[playerId].socketId = socket.id;
      game.players[playerId].name = cleanName;
    } else {
      game.players[playerId] = {
        name: cleanName,
        score: 0,
        connected: true,
        socketId: socket.id,
      };
    }

    game.socketToPlayerId[socket.id] = playerId;
    socket.data.roomCode = rc;
    socket.data.playerId = playerId;

    socket.join(rc);
    emitPlayers(rc);

    if (game.lockedPlayers.has(playerId)) {
      socket.emit("you-are-locked");
    }

    callback?.({ success: true, playerId });
    console.log(`Player "${cleanName}" ist Room ${rc} beigetreten (playerId=${playerId})`);
  });

  // --------------------------------
  // Spectator joint Raum (für Board-Sync)
  // --------------------------------
  socket.on("spectator-join-room", ({ roomCode }) => {
    const rc = normRoomCode(roomCode);
    const game = games[rc];
    if (!game) {
      console.log("Spectator wollte unbekannten Raum joinen:", rc);
      return;
    }

    ensureSpectators(game);
    game.spectators.add(socket.id);
    socket.data.isSpectator = true;

    socket.join(rc);
    console.log("Spectator verbunden mit Raum:", rc);

    // Aktuelle Runde senden
    socket.emit("spectator-round-changed", { round: game.currentRound || 1 });

    // Falls gerade eine Frage offen ist, an Late-Joiner senden
    if (game.currentQuestion) {
      socket.emit("spectator-question-opened", game.currentQuestion);
    }

    socket.emit("players-updated", game.players);
    socket.emit("buzzing-status", { enabled: game.buzzingEnabled });
  });

  // --------------------------------
  // Board joint Raum
  // --------------------------------
  socket.on("board-join-room", ({ roomCode }) => {
    const rc = normRoomCode(roomCode);
    const game = games[rc];
    if (!game) {
      console.log("Board wollte unbekannten Raum joinen:", rc);
      return;
    }

    ensureLockedPlayers(game);
    ensureSpectators(game);

    socket.join(rc);
    socket.data.roomCode = rc;
    socket.data.isBoard = true;
    console.log("Board verbunden mit Raum:", rc);

    socket.emit("players-updated", game.players);
    socket.emit("buzzing-status", { enabled: game.buzzingEnabled });
  });

  // --------------------------------
  // Board öffnet Frage -> an Spectators senden
  // --------------------------------
  socket.on("board-question-opened", ({ roomCode, categoryIndex, questionIndex, question, answer, value, type, imageUrl, timeLimit }) => {
    const rc = normRoomCode(roomCode);
    const game = games[rc];
    if (!game) return;

    game.currentQuestion = {
      categoryIndex,
      questionIndex,
      question,
      value,
      type,
      imageUrl,
      timeLimit,
    };

    io.to(rc).emit("spectator-question-opened", game.currentQuestion);
  });

  // --------------------------------
  // Board zeigt Antwort
  // --------------------------------
  socket.on("board-answer-shown", ({ roomCode, answer }) => {
    const rc = normRoomCode(roomCode);
    const game = games[rc];
    if (!game) return;

    io.to(rc).emit("spectator-answer-shown", { answer });
  });

  // --------------------------------
  // Board schliesst Frage
  // --------------------------------
  socket.on("board-question-closed", ({ roomCode, categoryIndex, questionIndex }) => {
    const rc = normRoomCode(roomCode);
    const game = games[rc];
    if (!game) return;

    game.currentQuestion = null;
    io.to(rc).emit("spectator-question-closed", { categoryIndex, questionIndex });
  });

  // --------------------------------
  // Board: Richtig
  // --------------------------------
  socket.on("board-correct", ({ roomCode }) => {
    const rc = normRoomCode(roomCode);
    const game = games[rc];
    if (!game) return;

    io.to(rc).emit("spectator-correct");
  });

  // --------------------------------
  // Board: Falsch
  // --------------------------------
  socket.on("board-wrong", ({ roomCode }) => {
    const rc = normRoomCode(roomCode);
    const game = games[rc];
    if (!game) return;

    io.to(rc).emit("spectator-wrong");
  });

  // --------------------------------
  // Runde wechseln
  // --------------------------------
  socket.on("board-round-changed", ({ roomCode, round }) => {
    const rc = normRoomCode(roomCode);
    const game = games[rc];
    if (!game) return;

    game.currentRound = round;
    io.to(rc).emit("spectator-round-changed", { round });
  });

  // --------------------------------
  // Turn Update
  // --------------------------------
  socket.on("board-turn-update", ({ roomCode, playerName }) => {
    const rc = normRoomCode(roomCode);
    const game = games[rc];
    if (!game) return;

    io.to(rc).emit("spectator-turn-update", { playerName });
  });

  // --------------------------------
  // Estimate Reveal an Spectators
  // --------------------------------
  socket.on("board-estimate-reveal", ({ roomCode, answers }) => {
    const rc = normRoomCode(roomCode);
    const game = games[rc];
    if (!game) return;

    io.to(rc).emit("spectator-estimate-reveal", { answers });
  });

  // -----------------------------
  // BUZZER & PUNKTE
  // -----------------------------
  socket.on("host-set-buzzing", ({ roomCode, enabled }) => {
    const rc = normRoomCode(roomCode);
    const game = games[rc];
    if (!game || game.hostId !== socket.id) return;

    ensureLockedPlayers(game);

    game.buzzingEnabled = !!enabled;
    game.firstBuzzId = null;
    io.to(rc).emit("buzzing-status", { enabled: game.buzzingEnabled });
  });

  socket.on("board-enable-buzz", ({ roomCode }) => {
    const rc = normRoomCode(roomCode);
    const game = games[rc];
    if (!game) return;

    ensureLockedPlayers(game);

    game.buzzingEnabled = true;
    game.firstBuzzId = null;

    io.to(rc).emit("buzzing-status", { enabled: true });

    // Gelockte Spieler erneut sperren
    for (const playerId of game.lockedPlayers) {
      const socketId = game.players[playerId]?.socketId;
      if (socketId) {
        io.to(socketId).emit("you-are-locked");
      }
    }
  });

  socket.on("player-buzz", ({ roomCode }) => {
    const rc = normRoomCode(roomCode);
    const game = games[rc];
    if (!game || !game.buzzingEnabled) return;

    ensureLockedPlayers(game);

    if (game.firstBuzzId) return;

    const playerId = game.socketToPlayerId[socket.id] || socket.data.playerId;
    if (!playerId) return;

    if (game.lockedPlayers.has(playerId)) {
      socket.emit("you-are-locked");
      return;
    }

    const player = game.players[playerId];
    if (!player || player.connected === false) return;

    game.firstBuzzId = playerId;

    io.to(rc).emit("player-buzzed-first", {
      playerId,
      name: player.name,
    });

    game.buzzingEnabled = false;
    io.to(rc).emit("buzzing-status", { enabled: false });
  });

  socket.on("host-update-score", ({ roomCode, playerId, delta }) => {
    const rc = normRoomCode(roomCode);
    const game = games[rc];
    if (!game || game.hostId !== socket.id) return;

    if (game.players[playerId]) {
      game.players[playerId].score += Number(delta || 0);
      emitPlayers(rc);
    }
  });

  socket.on("board-update-score", ({ roomCode, playerId, delta }) => {
    const rc = normRoomCode(roomCode);
    const game = games[rc];
    if (!game) return;

    if (game.players[playerId]) {
      game.players[playerId].score += Number(delta || 0);
      emitPlayers(rc);
    }
  });

  socket.on("board-lock-player", ({ roomCode, playerId }) => {
    const rc = normRoomCode(roomCode);
    const game = games[rc];
    if (!game) return;

    ensureLockedPlayers(game);
    if (!playerId) return;

    game.lockedPlayers.add(playerId);
    io.to(rc).emit("player-locked", { playerId });

    const targetSocketId = game.players?.[playerId]?.socketId;
    if (targetSocketId) {
      io.to(targetSocketId).emit("you-are-locked");
    }
  });

  socket.on("board-clear-locks", ({ roomCode }) => {
    const rc = normRoomCode(roomCode);
    const game = games[rc];
    if (!game) return;

    ensureLockedPlayers(game);
    game.lockedPlayers.clear();
    io.to(rc).emit("round-reset");
  });

  // -----------------------------
  // SCHÄTZFRAGEN
  // -----------------------------
  socket.on("board-estimate-start", ({ roomCode, question, timeLimit }) => {
    const rc = normRoomCode(roomCode);
    const game = games[rc];
    if (!game) return;

    const connectedIds = Object.entries(game.players)
      .filter(([, p]) => p && p.connected !== false)
      .map(([pid]) => pid);

    game.estimateRound = {
      active: true,
      answers: {},
      totalPlayers: connectedIds.length,
    };

    io.to(rc).emit("estimate-question-started", { question, timeLimit });

    if (game.estimateRound.totalPlayers === 0) {
      game.estimateRound.active = false;
      io.to(rc).emit("estimate-all-answered");
      io.to(rc).emit("estimate-locked");
    }
  });

  socket.on("board-estimate-end", ({ roomCode }) => {
    const rc = normRoomCode(roomCode);
    const game = games[rc];
    if (!game) return;

    if (game.estimateRound) game.estimateRound.active = false;
    io.to(rc).emit("estimate-locked");
  });

  socket.on("estimate-answer", ({ roomCode, value, noAnswer }) => {
    const rc = normRoomCode(roomCode);
    const game = games[rc];
    if (!game) return;

    const round = game.estimateRound;
    if (!round || !round.active) return;

    const playerId = game.socketToPlayerId[socket.id] || socket.data.playerId;
    if (!playerId || !game.players[playerId]) return;

    const player = game.players[playerId];
    if (!player || player.connected === false) return;

    round.answers[playerId] = {
      name: player.name,
      value,
      noAnswer: !!noAnswer,
    };

    io.to(rc).emit("estimate-answer-received-board", {
      playerId,
      name: player.name,
      value,
      noAnswer: !!noAnswer,
    });

    const answeredCount = Object.keys(round.answers).length;
    if (answeredCount >= round.totalPlayers) {
      round.active = false;
      io.to(rc).emit("estimate-all-answered");
      io.to(rc).emit("estimate-locked");
    }
  });

  // -----------------------------
  // Verbindung getrennt
  // -----------------------------
  socket.on("disconnect", () => {
    console.log("Client getrennt:", socket.id);

    // Host weg -> Spiel beenden
    for (const [rc, game] of Object.entries(games)) {
      if (game.hostId === socket.id) {
        io.to(rc).emit("game-ended");
        delete games[rc];
        return;
      }
    }

    // Spectator entfernen
    for (const [rc, game] of Object.entries(games)) {
      ensureSpectators(game);
      if (game.spectators.has(socket.id)) {
        game.spectators.delete(socket.id);
      }
    }

    // Player disconnect
    const rc = socket.data.roomCode;
    const pid = socket.data.playerId;

    if (rc && pid) {
      const game = games[rc];
      if (game && game.players[pid]) {
        game.players[pid].connected = false;
        game.players[pid].socketId = null;

        if (game.socketToPlayerId && game.socketToPlayerId[socket.id]) {
          delete game.socketToPlayerId[socket.id];
        }

        emitPlayers(rc);
        return;
      }
    }

    // Fallback
    for (const [roomCode, game] of Object.entries(games)) {
      const playerId = game.socketToPlayerId?.[socket.id];
      if (!playerId) continue;

      if (game.players[playerId]) {
        game.players[playerId].connected = false;
        game.players[playerId].socketId = null;
      }

      delete game.socketToPlayerId[socket.id];
      emitPlayers(roomCode);
      return;
    }
  });
});

// Port
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log("Server läuft auf Port " + PORT);
});
