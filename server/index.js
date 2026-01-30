// server/index.js
// Jeopardy Server - MIT SPECTATOR/ONLINE-MODUS + WEBRTC KAMERA SUPPORT

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

function ensureCamPlayers(game) {
  if (!game.camPlayers || !(game.camPlayers instanceof Set)) {
    game.camPlayers = new Set();
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
      camPlayers: new Set(), // Spieler mit Kamera
      boardSocketId: null,   // Board-Socket für WebRTC
      estimateRound: null,
      currentRound: 1,
      currentQuestion: null,
    };

    socket.join(roomCode);
    console.log("Game erstellt:", roomCode);
    callback?.({ success: true, roomCode });
  });

  // --------------------------------
  // Spieler joint / re-joint
  // --------------------------------
  socket.on("player-join", ({ roomCode, name, hasCamera }, callback) => {
    const rc = normRoomCode(roomCode);
    const game = games[rc];

    if (!game) return callback?.({ success: false, error: "Room nicht gefunden" });

    ensureLockedPlayers(game);
    ensureSpectators(game);
    ensureCamPlayers(game);

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
      game.players[playerId].hasCamera = !!hasCamera;
    } else {
      game.players[playerId] = {
        name: cleanName,
        score: 0,
        connected: true,
        socketId: socket.id,
        hasCamera: !!hasCamera,
      };
    }

    // Kamera-Tracking
    if (hasCamera) {
      game.camPlayers.add(playerId);
    }

    game.socketToPlayerId[socket.id] = playerId;
    socket.data.roomCode = rc;
    socket.data.playerId = playerId;
    socket.data.hasCamera = !!hasCamera;

    socket.join(rc);
    emitPlayers(rc);

    if (game.lockedPlayers.has(playerId)) {
      socket.emit("you-are-locked");
    }

    callback?.({ success: true, playerId });
    console.log(`Player "${cleanName}" ist Room ${rc} beigetreten (playerId=${playerId}, cam=${hasCamera})`);
  });

  // --------------------------------
  // Spectator joint Raum (für Board-Sync)
  // --------------------------------
  socket.on("spectator-join-room", ({ roomCode, hasCamera }) => {
    const rc = normRoomCode(roomCode);
    const game = games[rc];
    if (!game) {
      console.log("Spectator wollte unbekannten Raum joinen:", rc);
      return;
    }

    ensureSpectators(game);
    game.spectators.add(socket.id);
    socket.data.isSpectator = true;
    socket.data.hasCamera = !!hasCamera;

    socket.join(rc);
    console.log("Spectator verbunden mit Raum:", rc, "hasCamera:", hasCamera);

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
  socket.on("board-join-room", ({ roomCode, isCamMode }) => {
    const rc = normRoomCode(roomCode);
    const game = games[rc];
    if (!game) {
      console.log("Board wollte unbekannten Raum joinen:", rc);
      return;
    }

    ensureLockedPlayers(game);
    ensureSpectators(game);
    ensureCamPlayers(game);

    socket.join(rc);
    socket.data.roomCode = rc;
    socket.data.isBoard = true;
    socket.data.isCamMode = !!isCamMode;

    // Board-Socket speichern für WebRTC
    if (isCamMode) {
      game.boardSocketId = socket.id;
      game.hostId = socket.id; // WICHTIG: hostId aktualisieren!
      
      // WICHTIG: Allen Kamera-Spielern mitteilen, dass Board bereit ist!
      for (const playerId of game.camPlayers) {
        const player = game.players[playerId];
        if (player && player.connected && player.socketId) {
          // Spieler soll seinen Stream zum Board senden
          io.to(player.socketId).emit("board-socket-id", { socketId: socket.id });
          console.log("Board-Socket-ID an Spieler gesendet:", player.name, player.socketId);
        }
      }
    }

    console.log("Board verbunden mit Raum:", rc, "camMode:", isCamMode);

    socket.emit("players-updated", game.players);
    socket.emit("buzzing-status", { enabled: game.buzzingEnabled });

    // Wenn Cam-Modus, alle bereits verbundenen Cam-Player mitteilen
    if (isCamMode) {
      for (const playerId of game.camPlayers) {
        const player = game.players[playerId];
        if (player && player.connected && player.socketId) {
          socket.emit("cam-player-connected", {
            playerId,
            socketId: player.socketId,
            name: player.name,
          });
        }
      }
    }
  });

  // --------------------------------
  // Board fragt nach Spielerliste (für periodische Überprüfung)
  // --------------------------------
  socket.on("request-players", ({ roomCode }) => {
    const rc = normRoomCode(roomCode);
    const game = games[rc];
    if (!game) return;
    
    socket.emit("players-list", game.players);
  });

  // --------------------------------
  // Cam Player bereit (signalisiert Board + andere Spieler)
  // --------------------------------
  socket.on("cam-player-ready", ({ roomCode, playerId }) => {
    const rc = normRoomCode(roomCode);
    const game = games[rc];
    if (!game) return;

    ensureCamPlayers(game);

    const player = game.players[playerId];
    if (!player) return;

    // Socket-ID aktualisieren
    player.socketId = socket.id;
    game.camPlayers.add(playerId);

    console.log("Cam player ready:", playerId, "socket:", socket.id);

    // Board benachrichtigen
    if (game.boardSocketId) {
      io.to(game.boardSocketId).emit("cam-player-connected", {
        playerId,
        socketId: socket.id,
        name: player.name,
      });
      
      // Board-Socket-ID an neuen Spieler senden
      socket.emit("board-socket-id", { socketId: game.boardSocketId });
      console.log("Board-Socket-ID an Spieler gesendet:", player.name);
    }

    // NEUE LOGIK: Andere Spieler über neuen Spieler informieren
    // Und neuen Spieler über alle bestehenden Spieler informieren
    for (const otherId of game.camPlayers) {
      if (otherId === playerId) continue; // Nicht sich selbst
      
      const other = game.players[otherId];
      if (!other || !other.connected || !other.socketId) continue;

      // Anderen Spieler über diesen neuen informieren
      io.to(other.socketId).emit("other-player-cam-ready", {
        playerId,
        socketId: socket.id,
        name: player.name,
      });
      console.log("Informiere", other.name, "über neuen Spieler:", player.name);

      // Diesen neuen Spieler über andere informieren
      socket.emit("other-player-cam-ready", {
        playerId: otherId,
        socketId: other.socketId,
        name: other.name,
      });
      console.log("Informiere", player.name, "über bestehenden Spieler:", other.name);
    }
  });

  // ================================
  // WEBRTC SIGNALING - FIXED!
  // ================================

  // Spieler fragt nach Board Socket-ID
  socket.on("request-board-socket-id", ({ roomCode }) => {
    const rc = normRoomCode(roomCode);
    const game = games[rc];
    if (!game || !game.boardSocketId) return;

    socket.emit("board-socket-id", { socketId: game.boardSocketId });
    console.log("Board Socket-ID gesendet an:", socket.id, "->", game.boardSocketId);
  });

  // Board sendet seine Socket-ID an einen Spieler
  socket.on("send-board-socket-id", ({ roomCode, targetId }) => {
    const rc = normRoomCode(roomCode);
    const game = games[rc];
    if (!game) return;

    io.to(targetId).emit("board-socket-id", { socketId: socket.id });
    console.log("Board Socket-ID direkt gesendet an:", targetId);
  });

  // Spectator fragt nach Host-Stream
  socket.on("request-host-stream", ({ roomCode }) => {
    const rc = normRoomCode(roomCode);
    const game = games[rc];
    if (!game || !game.hostId) return;

    // Weiterleiten an das Board
    io.to(game.hostId).emit("request-host-stream", { fromSocketId: socket.id });
    console.log("Host-Stream angefordert von", socket.id, "für Room", rc);
  });

  // Board fragt Player nach Offer
  socket.on("webrtc-request-offer", ({ roomCode, targetId }) => {
    const rc = normRoomCode(roomCode);
    const game = games[rc];
    if (!game) return;

    io.to(targetId).emit("webrtc-request-offer", { fromId: socket.id });
    console.log("WebRTC: Request offer from", targetId, "to", socket.id);
  });

  // Player/Board sendet Offer - FIXED: streamType und playerId weiterleiten
  socket.on("webrtc-offer", ({ roomCode, targetId, offer, streamType, playerId }) => {
    const rc = normRoomCode(roomCode);
    const game = games[rc];
    if (!game) return;

    io.to(targetId).emit("webrtc-offer", { 
      fromId: socket.id, 
      offer,
      streamType: streamType || "player",
      playerId: playerId || null
    });
    console.log("WebRTC: Offer from", socket.id, "to", targetId, "type:", streamType);
  });

  // Player/Board sendet Answer - inkl. P2P playerId
  socket.on("webrtc-answer", ({ roomCode, targetId, answer, streamType, playerId }) => {
    const rc = normRoomCode(roomCode);
    const game = games[rc];
    if (!game) return;

    io.to(targetId).emit("webrtc-answer", { 
      fromId: socket.id, 
      answer,
      streamType: streamType || "player",
      playerId: playerId || null
    });
    console.log("WebRTC: Answer from", socket.id, "to", targetId, "type:", streamType);
  });

  // ICE Candidate weiterleiten - inkl. P2P
  socket.on("webrtc-ice-candidate", ({ roomCode, targetId, candidate, streamType, fromPlayerId, toPlayerId }) => {
    const rc = normRoomCode(roomCode);
    const game = games[rc];
    if (!game) return;

    io.to(targetId).emit("webrtc-ice-candidate", { 
      fromId: socket.id, 
      candidate,
      streamType: streamType || "player",
      fromPlayerId: fromPlayerId || null,
      toPlayerId: toPlayerId || null
    });
  });

  // Host Cam bereit
  socket.on("host-cam-ready", ({ roomCode }) => {
    const rc = normRoomCode(roomCode);
    const game = games[rc];
    if (!game) return;

    // An alle Spectators (mit Cam) und Board senden
    io.to(rc).emit("host-cam-available", { socketId: socket.id });
    console.log("Host cam ready in room:", rc);
  });

  // ================================
  // BOARD SYNC EVENTS (wie vorher)
  // ================================

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

  socket.on("board-answer-shown", ({ roomCode, answer }) => {
    const rc = normRoomCode(roomCode);
    const game = games[rc];
    if (!game) return;

    io.to(rc).emit("spectator-answer-shown", { answer });
  });

  socket.on("board-question-closed", ({ roomCode, categoryIndex, questionIndex }) => {
    const rc = normRoomCode(roomCode);
    const game = games[rc];
    if (!game) return;

    game.currentQuestion = null;
    io.to(rc).emit("spectator-question-closed", { categoryIndex, questionIndex });
  });

  socket.on("board-correct", ({ roomCode }) => {
    const rc = normRoomCode(roomCode);
    const game = games[rc];
    if (!game) return;

    io.to(rc).emit("spectator-correct");
  });

  socket.on("board-wrong", ({ roomCode }) => {
    const rc = normRoomCode(roomCode);
    const game = games[rc];
    if (!game) return;

    io.to(rc).emit("spectator-wrong");
  });

  socket.on("board-round-changed", ({ roomCode, round }) => {
    const rc = normRoomCode(roomCode);
    const game = games[rc];
    if (!game) return;

    game.currentRound = round;
    io.to(rc).emit("spectator-round-changed", { round });
  });

  socket.on("board-turn-update", ({ roomCode, playerName, playerId }) => {
    const rc = normRoomCode(roomCode);
    const game = games[rc];
    if (!game) return;

    io.to(rc).emit("spectator-turn-update", { playerName, playerId });
  });

  socket.on("board-turn-preview", ({ roomCode, playerName, playerId }) => {
    const rc = normRoomCode(roomCode);
    const game = games[rc];
    if (!game) return;

    io.to(rc).emit("spectator-turn-preview", { playerName, playerId });
  });

  socket.on("board-estimate-reveal", ({ roomCode, answers }) => {
    const rc = normRoomCode(roomCode);
    const game = games[rc];
    if (!game) return;

    io.to(rc).emit("spectator-estimate-reveal", { answers });
  });

  // ================================
  // BUZZER & PUNKTE (wie vorher)
  // ================================
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

  // ================================
  // SCHÄTZFRAGEN (wie vorher)
  // ================================
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

  // ================================
  // DISCONNECT
  // ================================
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

    // Board disconnect
    for (const [rc, game] of Object.entries(games)) {
      if (game.boardSocketId === socket.id) {
        game.boardSocketId = null;
      }
    }

    // Spectator entfernen
    for (const [rc, game] of Object.entries(games)) {
      ensureSpectators(game);
      if (game.spectators.has(socket.id)) {
        game.spectators.delete(socket.id);
      }
    }

    // Cam Player entfernen
    const rc = socket.data.roomCode;
    const pid = socket.data.playerId;

    if (rc && pid) {
      const game = games[rc];
      if (game) {
        ensureCamPlayers(game);

        // Cam Player disconnect an Board melden
        if (game.camPlayers.has(pid) && game.boardSocketId) {
          io.to(game.boardSocketId).emit("cam-player-disconnected", { playerId: pid });
        }

        if (game.players[pid]) {
          game.players[pid].connected = false;
          game.players[pid].socketId = null;

          if (game.socketToPlayerId && game.socketToPlayerId[socket.id]) {
            delete game.socketToPlayerId[socket.id];
          }

          emitPlayers(rc);
          return;
        }
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
