// server/index.js
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
  return String(roomCode || "")
    .trim()
    .toUpperCase();
}

// Stabiler Player-Key aus Name
function playerKeyFromName(name) {
  return String(name || "")
    .trim()
    .toLowerCase();
}

// Players an alle im Raum senden (inkl. connected)
function emitPlayers(roomCode) {
  const game = games[roomCode];
  if (!game) return;
  io.to(roomCode).emit("players-updated", game.players);
}

// Helper: immer sicherstellen, dass lockedPlayers existiert
function ensureLockedPlayers(game) {
  if (!game.lockedPlayers || !(game.lockedPlayers instanceof Set)) {
    game.lockedPlayers = new Set();
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

      // playerId -> { name, score, connected, socketId }
      players: {},

      // socket.id -> playerId (für Disconnect/Buzz/Estimate)
      socketToPlayerId: {},

      buzzingEnabled: false,

      // speichert playerId (nicht socketId)
      firstBuzzId: null,

      // ✅ Server-seitige Locks pro Frage
      lockedPlayers: new Set(),

      estimateRound: null,
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

    if (!game)
      return callback?.({ success: false, error: "Room nicht gefunden" });

    ensureLockedPlayers(game);

    const cleanName = String(name || "").trim();
    if (!cleanName)
      return callback?.({
        success: false,
        error: "Bitte einen Namen eingeben",
      });

    const playerId = playerKeyFromName(cleanName);

    // Reconnect: wenn Player schon existiert -> Score behalten
    if (game.players[playerId]) {
      const prevSocketId = game.players[playerId].socketId;

      // alte socket map entfernen (falls vorhanden)
      if (prevSocketId && game.socketToPlayerId[prevSocketId] === playerId) {
        delete game.socketToPlayerId[prevSocketId];
      }

      game.players[playerId].connected = true;
      game.players[playerId].socketId = socket.id;

      // Name aktualisieren (Groß-/Kleinschreibung)
      game.players[playerId].name = cleanName;
    } else {
      // neu
      game.players[playerId] = {
        name: cleanName,
        score: 0,
        connected: true,
        socketId: socket.id,
      };
    }

    // mapping + socket.data setzen (WICHTIG für disconnect)
    game.socketToPlayerId[socket.id] = playerId;
    socket.data.roomCode = rc;
    socket.data.playerId = playerId;

    socket.join(rc);
    emitPlayers(rc);

    // ✅ Wenn Player gerade gelockt ist (Frage läuft), sofort an Client melden
    if (game.lockedPlayers.has(playerId)) {
      socket.emit("you-are-locked");
    }

    callback?.({ success: true, playerId });

    console.log(
      `Player "${cleanName}" ist Room ${rc} beigetreten (playerId=${playerId})`,
    );
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

    socket.join(rc);
    console.log("Board verbunden mit Raum:", rc);

    socket.emit("players-updated", game.players);
    socket.emit("buzzing-status", { enabled: game.buzzingEnabled });
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

  // Board will Buzz wieder freigeben (z.B. nach Falsch)
  socket.on("board-enable-buzz", ({ roomCode }) => {
    const rc = normRoomCode(roomCode);
    const game = games[rc];
    if (!game) return;

    ensureLockedPlayers(game);

    game.buzzingEnabled = true;
    game.firstBuzzId = null;

    // 1️⃣ Buzz ist wieder offen
    io.to(rc).emit("buzzing-status", { enabled: true });

    // 2️⃣ ABER: gelockte Spieler explizit erneut sperren (Client-State!)
    for (const playerId of game.lockedPlayers) {
      const socketId = game.players[playerId]?.socketId;
      if (socketId) {
        io.to(socketId).emit("you-are-locked");
      }
    }
  });

  // Spieler drückt Buzzer
  socket.on("player-buzz", ({ roomCode }) => {
    const rc = normRoomCode(roomCode);
    const game = games[rc];
    if (!game || !game.buzzingEnabled) return;

    ensureLockedPlayers(game);

    // wenn schon jemand gebuzzert hat -> ignorieren
    if (game.firstBuzzId) return;

    const playerId = game.socketToPlayerId[socket.id] || socket.data.playerId;
    if (!playerId) return;

    // ✅ wenn gelockt -> darf NICHT buzzern
    if (game.lockedPlayers.has(playerId)) {
      // optional: nochmal an Client schicken, falls UI out-of-sync
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

  // ✅ Board sperrt einen Player für die AKTUELLE Frage
  socket.on("board-lock-player", ({ roomCode, playerId }) => {
    const rc = normRoomCode(roomCode);
    const game = games[rc];
    if (!game) return;

    ensureLockedPlayers(game);

    if (!playerId) return;

    game.lockedPlayers.add(playerId);

    // 1) Board/alle: optional UI-Info
    io.to(rc).emit("player-locked", { playerId });

    // 2) NUR an den betroffenen Player: "du bist gesperrt"
    const targetSocketId = game.players?.[playerId]?.socketId;
    if (targetSocketId) {
      io.to(targetSocketId).emit("you-are-locked");
    }
  });

  // ✅ Board setzt Locks zurück (wenn Frage geschlossen wird)
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

    // nur CONNECTED Spieler zählen
    const connectedIds = Object.entries(game.players)
      .filter(([, p]) => p && p.connected !== false)
      .map(([pid]) => pid);

    game.estimateRound = {
      active: true,
      answers: {}, // playerId -> { name, value, noAnswer }
      totalPlayers: connectedIds.length,
    };

    io.to(rc).emit("estimate-question-started", {
      question,
      timeLimit,
    });

    // Edge case: 0 connected
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

    // 1) Wenn Host weg -> Spiel beenden
    for (const [rc, game] of Object.entries(games)) {
      if (game.hostId === socket.id) {
        io.to(rc).emit("game-ended");
        delete games[rc];
        return;
      }
    }

    // 2) Primär über socket.data (sauberer Weg)
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

    // 3) Fallback: über Mapping / Scan (falls socket.data leer ist)
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
