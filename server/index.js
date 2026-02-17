// server/index.js - Jeopardy Server MIT TEAMS MODUS

const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const path = require("path");

const app = express();
const server = http.createServer(app);
const io = new Server(server);

const HOST_PASSWORD = "baman187";

const publicPath = path.join(__dirname, "..", "public");
app.use(express.static(publicPath));
app.get("/", (req, res) => res.sendFile(path.join(publicPath, "index.html")));

const games = {};
let localTeamsGame = null;

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

function ensureTeams(game) {
  if (!game.teams) game.teams = {};
}

function emitTeams(roomCode) {
  const game = games[roomCode];
  if (!game) return;
  ensureTeams(game);
  io.to(roomCode).emit("teams-updated", game.teams);
}

function updateTeamScores(game) {
  ensureTeams(game);
  for (const teamId of Object.keys(game.teams)) {
    let total = 0;
    for (const playerId of (game.teams[teamId].members || [])) {
      const player = game.players[playerId];
      if (player) total += player.score || 0;
    }
    game.teams[teamId].score = total;
  }
}

function ensureLockedPlayers(game) {
  if (!game.lockedPlayers || !(game.lockedPlayers instanceof Set)) game.lockedPlayers = new Set();
}

function ensureSpectators(game) {
  if (!game.spectators || !(game.spectators instanceof Set)) game.spectators = new Set();
}

function ensureCamPlayers(game) {
  if (!game.camPlayers || !(game.camPlayers instanceof Set)) game.camPlayers = new Set();
}

io.on("connection", (socket) => {
  console.log("Client verbunden:", socket.id);

  // HOST ERSTELLT SPIEL (Normal)
  socket.on("host-create-game", ({ password } = {}, callback) => {
    if (password !== HOST_PASSWORD) return callback?.({ success: false, error: "Falsches Passwort" });
    const roomCode = createRoomCode();
    games[roomCode] = {
      hostId: socket.id, isTeamsMode: false, players: {}, socketToPlayerId: {},
      buzzingEnabled: false, firstBuzzId: null, lockedPlayers: new Set(),
      spectators: new Set(), camPlayers: new Set(), boardSocketId: null,
      estimateRound: null, currentRound: 1, currentQuestion: null,
    };
    socket.join(roomCode);
    callback?.({ success: true, roomCode });
  });

  // HOST ERSTELLT TEAMS SPIEL
  socket.on("host-create-teams-game", ({ password } = {}, callback) => {
    if (password !== HOST_PASSWORD) return callback?.({ success: false, error: "Falsches Passwort" });
    const roomCode = createRoomCode();
    games[roomCode] = {
      hostId: socket.id, isTeamsMode: true, players: {}, teams: {}, socketToPlayerId: {},
      buzzingEnabled: false, firstBuzzId: null, lockedPlayers: new Set(),
      spectators: new Set(), camPlayers: new Set(), boardSocketId: null,
      estimateRound: null, currentRound: 1, currentQuestion: null,
    };
    socket.join(roomCode);
    callback?.({ success: true, roomCode });
  });

  // TEAMS MANAGEMENT
  socket.on("teams-create-team", ({ roomCode, name, colorId }) => {
    const rc = normRoomCode(roomCode);
    const game = games[rc];
    if (!game) return;
    ensureTeams(game);
    const teamId = String(name || "").trim().toLowerCase().replace(/\s+/g, "-");
    if (!teamId || game.teams[teamId]) return;
    game.teams[teamId] = { name: String(name || "").trim(), colorId: colorId || "blue", score: 0, members: [] };
    emitTeams(rc);
  });

  // ── GEÄNDERT: Callback + teamId zurückgeben ──
  socket.on("teams-create-team-local", ({ name, colorId, roomCode }, callback) => {
    if (!localTeamsGame) localTeamsGame = { teams: {}, players: {}, socketToPlayerId: {}, buzzingEnabled: false, firstBuzzId: null };
    const teamId = String(name || "").trim().toLowerCase().replace(/\s+/g, "-");
    if (!teamId) return callback?.({ success: false, error: "Kein Teamname" });
    if (localTeamsGame.teams[teamId]) return callback?.({ success: false, error: "Team existiert bereits" });
    localTeamsGame.teams[teamId] = { name: String(name || "").trim(), colorId: colorId || "blue", score: 0, members: [] };
    io.emit("teams-updated", localTeamsGame.teams);
    callback?.({ success: true, teamId });
  });

  socket.on("request-teams", ({ roomCode }) => {
    const rc = normRoomCode(roomCode);
    const game = games[rc];
    if (!game) { socket.emit("teams-updated", {}); return; }
    ensureTeams(game);
    socket.emit("teams-updated", game.teams);
  });

  socket.on("request-teams-local", () => {
    if (!localTeamsGame) localTeamsGame = { teams: {}, players: {}, socketToPlayerId: {}, buzzingEnabled: false, firstBuzzId: null };
    socket.emit("teams-updated", localTeamsGame.teams);
  });

  // SPIELER JOIN MIT TEAM (Online)
  socket.on("player-join-teams", ({ roomCode, name, teamId, hasCamera }, callback) => {
    const rc = normRoomCode(roomCode);
    const game = games[rc];
    if (!game) return callback?.({ success: false, error: "Room nicht gefunden" });
    ensureLockedPlayers(game); ensureSpectators(game); ensureCamPlayers(game); ensureTeams(game);
    const cleanName = String(name || "").trim();
    if (!cleanName) return callback?.({ success: false, error: "Bitte Namen eingeben" });
    if (!teamId || !game.teams[teamId]) return callback?.({ success: false, error: "Team nicht gefunden" });
    const playerId = playerKeyFromName(cleanName);
    if (game.players[playerId]) {
      const prevSocketId = game.players[playerId].socketId;
      if (prevSocketId && game.socketToPlayerId[prevSocketId] === playerId) delete game.socketToPlayerId[prevSocketId];
      game.players[playerId].connected = true;
      game.players[playerId].socketId = socket.id;
      game.players[playerId].name = cleanName;
      game.players[playerId].hasCamera = !!hasCamera;
      game.players[playerId].teamId = teamId;
    } else {
      game.players[playerId] = { name: cleanName, score: 0, connected: true, socketId: socket.id, hasCamera: !!hasCamera, teamId };
    }
    if (!game.teams[teamId].members.includes(playerId)) game.teams[teamId].members.push(playerId);
    if (hasCamera) game.camPlayers.add(playerId);
    game.socketToPlayerId[socket.id] = playerId;
    socket.data.roomCode = rc; socket.data.playerId = playerId; socket.data.teamId = teamId; socket.data.hasCamera = !!hasCamera;
    socket.join(rc);
    updateTeamScores(game); emitPlayers(rc); emitTeams(rc);
    if (game.lockedPlayers.has(playerId)) socket.emit("you-are-locked");
    callback?.({ success: true, playerId, teamId });
  });

  // SPIELER JOIN MIT TEAM (Lokal)
  socket.on("player-join-teams-local", ({ name, teamId, roomCode }, callback) => {
    if (!localTeamsGame) return callback?.({ success: false, error: "Kein lokales Spiel" });
    const cleanName = String(name || "").trim();
    if (!cleanName) return callback?.({ success: false, error: "Bitte Namen eingeben" });
    if (!teamId || !localTeamsGame.teams[teamId]) return callback?.({ success: false, error: "Team nicht gefunden" });
    const playerId = playerKeyFromName(cleanName);
    localTeamsGame.players[playerId] = { name: cleanName, score: 0, connected: true, socketId: socket.id, teamId };
    if (!localTeamsGame.teams[teamId].members.includes(playerId)) localTeamsGame.teams[teamId].members.push(playerId);
    localTeamsGame.socketToPlayerId[socket.id] = playerId;
    socket.data.playerId = playerId; socket.data.teamId = teamId; socket.data.isLocalTeams = true;
    io.emit("teams-updated", localTeamsGame.teams);
    io.emit("players-updated", localTeamsGame.players);
    callback?.({ success: true, playerId, teamId });
  });

  // BUZZER FÜR TEAMS (Lokal)
  socket.on("player-buzz-teams-local", ({ teamId }) => {
    if (!localTeamsGame || !localTeamsGame.buzzingEnabled || localTeamsGame.firstBuzzId) return;
    const playerId = localTeamsGame.socketToPlayerId[socket.id];
    if (!playerId) return;
    const player = localTeamsGame.players[playerId];
    if (!player) return;
    const team = localTeamsGame.teams[teamId];
    localTeamsGame.firstBuzzId = playerId;
    localTeamsGame.buzzingEnabled = false;
    io.emit("player-buzzed-first", { playerId, name: player.name, teamId, teamName: team?.name || "" });
    io.emit("buzzing-status", { enabled: false });
  });

  // SPIELER JOIN (Normal)
  socket.on("player-join", ({ roomCode, name, hasCamera }, callback) => {
    const rc = normRoomCode(roomCode);
    const game = games[rc];
    if (!game) return callback?.({ success: false, error: "Room nicht gefunden" });
    ensureLockedPlayers(game); ensureSpectators(game); ensureCamPlayers(game);
    const cleanName = String(name || "").trim();
    if (!cleanName) return callback?.({ success: false, error: "Bitte Namen eingeben" });
    const playerId = playerKeyFromName(cleanName);
    if (game.players[playerId]) {
      const prevSocketId = game.players[playerId].socketId;
      if (prevSocketId && game.socketToPlayerId[prevSocketId] === playerId) delete game.socketToPlayerId[prevSocketId];
      game.players[playerId].connected = true;
      game.players[playerId].socketId = socket.id;
      game.players[playerId].name = cleanName;
      game.players[playerId].hasCamera = !!hasCamera;
    } else {
      game.players[playerId] = { name: cleanName, score: 0, connected: true, socketId: socket.id, hasCamera: !!hasCamera };
    }
    if (hasCamera) game.camPlayers.add(playerId);
    game.socketToPlayerId[socket.id] = playerId;
    socket.data.roomCode = rc; socket.data.playerId = playerId; socket.data.hasCamera = !!hasCamera;
    socket.join(rc); emitPlayers(rc);
    if (game.lockedPlayers.has(playerId)) socket.emit("you-are-locked");
    callback?.({ success: true, playerId });
  });

  // SPECTATOR JOIN
  socket.on("spectator-join-room", ({ roomCode, hasCamera }) => {
    const rc = normRoomCode(roomCode);
    const game = games[rc];
    if (!game) return;
    ensureSpectators(game); ensureTeams(game);
    game.spectators.add(socket.id);
    socket.data.isSpectator = true; socket.data.hasCamera = !!hasCamera;
    socket.join(rc);
    socket.emit("spectator-round-changed", { round: game.currentRound || 1 });
    if (game.currentQuestion) socket.emit("spectator-question-opened", game.currentQuestion);
    socket.emit("players-updated", game.players);
    socket.emit("buzzing-status", { enabled: game.buzzingEnabled });
    if (game.isTeamsMode) socket.emit("teams-updated", game.teams);
  });

  // BOARD JOIN
  socket.on("board-join-room", ({ roomCode, isCamMode }) => {
    const rc = normRoomCode(roomCode);
    const game = games[rc];
    if (!game) return;
    ensureLockedPlayers(game); ensureSpectators(game); ensureCamPlayers(game); ensureTeams(game);
    socket.join(rc);
    socket.data.roomCode = rc; socket.data.isBoard = true; socket.data.isCamMode = !!isCamMode;
    if (isCamMode) {
      game.boardSocketId = socket.id;
      game.hostId = socket.id;
      for (const playerId of game.camPlayers) {
        const player = game.players[playerId];
        if (player?.connected && player.socketId) io.to(player.socketId).emit("board-socket-id", { socketId: socket.id });
      }
    }
    socket.emit("players-updated", game.players);
    socket.emit("buzzing-status", { enabled: game.buzzingEnabled });
    if (game.isTeamsMode) socket.emit("teams-updated", game.teams);
    if (isCamMode) {
      for (const playerId of game.camPlayers) {
        const player = game.players[playerId];
        if (player?.connected && player.socketId) socket.emit("cam-player-connected", { playerId, socketId: player.socketId, name: player.name });
      }
    }
  });

  // WEBRTC SIGNALING
  socket.on("request-players", ({ roomCode }) => { const game = games[normRoomCode(roomCode)]; if (game) socket.emit("players-list", game.players); });
  socket.on("cam-player-ready", ({ roomCode, playerId }) => {
    const rc = normRoomCode(roomCode);
    const game = games[rc];
    if (!game) return;
    ensureCamPlayers(game);
    const player = game.players[playerId];
    if (!player) return;
    player.socketId = socket.id;
    game.camPlayers.add(playerId);
    if (game.boardSocketId) {
      io.to(game.boardSocketId).emit("cam-player-connected", { playerId, socketId: socket.id, name: player.name });
      socket.emit("board-socket-id", { socketId: game.boardSocketId });
    }
    for (const otherId of game.camPlayers) {
      if (otherId === playerId) continue;
      const other = game.players[otherId];
      if (!other?.connected || !other.socketId) continue;
      io.to(other.socketId).emit("other-player-cam-ready", { playerId, socketId: socket.id, name: player.name });
      socket.emit("other-player-cam-ready", { playerId: otherId, socketId: other.socketId, name: other.name });
    }
  });
  socket.on("request-board-socket-id", ({ roomCode }) => { const game = games[normRoomCode(roomCode)]; if (game?.boardSocketId) socket.emit("board-socket-id", { socketId: game.boardSocketId }); });
  socket.on("send-board-socket-id", ({ roomCode, targetId }) => { const game = games[normRoomCode(roomCode)]; if (game) io.to(targetId).emit("board-socket-id", { socketId: socket.id }); });
  socket.on("request-host-stream", ({ roomCode }) => { const game = games[normRoomCode(roomCode)]; if (game?.hostId) io.to(game.hostId).emit("request-host-stream", { fromSocketId: socket.id }); });
  socket.on("webrtc-request-offer", ({ roomCode, targetId }) => { if (games[normRoomCode(roomCode)]) io.to(targetId).emit("webrtc-request-offer", { fromId: socket.id }); });
  socket.on("webrtc-offer", ({ roomCode, targetId, offer, streamType, playerId }) => { if (games[normRoomCode(roomCode)]) io.to(targetId).emit("webrtc-offer", { fromId: socket.id, offer, streamType: streamType || "player", playerId: playerId || null }); });
  socket.on("webrtc-answer", ({ roomCode, targetId, answer, streamType, playerId }) => { if (games[normRoomCode(roomCode)]) io.to(targetId).emit("webrtc-answer", { fromId: socket.id, answer, streamType: streamType || "player", playerId: playerId || null }); });
  socket.on("webrtc-ice-candidate", ({ roomCode, targetId, candidate, streamType, fromPlayerId, toPlayerId }) => { if (games[normRoomCode(roomCode)]) io.to(targetId).emit("webrtc-ice-candidate", { fromId: socket.id, candidate, streamType: streamType || "player", fromPlayerId, toPlayerId }); });
  socket.on("host-cam-ready", ({ roomCode }) => { if (games[normRoomCode(roomCode)]) io.to(normRoomCode(roomCode)).emit("host-cam-available", { socketId: socket.id }); });

  // BOARD SYNC EVENTS
  socket.on("board-question-opened", ({ roomCode, categoryIndex, questionIndex, question, answer, value, type, imageUrl, timeLimit }) => {
    const game = games[normRoomCode(roomCode)];
    if (!game) return;
    game.currentQuestion = { categoryIndex, questionIndex, question, value, type, imageUrl, timeLimit };
    io.to(normRoomCode(roomCode)).emit("spectator-question-opened", game.currentQuestion);
  });
  socket.on("board-answer-shown", ({ roomCode, answer }) => { if (games[normRoomCode(roomCode)]) io.to(normRoomCode(roomCode)).emit("spectator-answer-shown", { answer }); });
  socket.on("board-question-closed", ({ roomCode, categoryIndex, questionIndex }) => { const game = games[normRoomCode(roomCode)]; if (game) { game.currentQuestion = null; io.to(normRoomCode(roomCode)).emit("spectator-question-closed", { categoryIndex, questionIndex }); } });
  socket.on("board-correct", ({ roomCode }) => { if (games[normRoomCode(roomCode)]) io.to(normRoomCode(roomCode)).emit("spectator-correct"); });
  socket.on("board-wrong", ({ roomCode }) => { if (games[normRoomCode(roomCode)]) io.to(normRoomCode(roomCode)).emit("spectator-wrong"); });
  socket.on("board-round-changed", ({ roomCode, round }) => { const game = games[normRoomCode(roomCode)]; if (game) { game.currentRound = round; io.to(normRoomCode(roomCode)).emit("spectator-round-changed", { round }); } });
  socket.on("board-turn-update", ({ roomCode, playerName, playerId }) => { if (games[normRoomCode(roomCode)]) io.to(normRoomCode(roomCode)).emit("spectator-turn-update", { playerName, playerId }); });
  socket.on("board-turn-preview", ({ roomCode, playerName, playerId }) => { if (games[normRoomCode(roomCode)]) io.to(normRoomCode(roomCode)).emit("spectator-turn-preview", { playerName, playerId }); });
  socket.on("board-estimate-reveal", ({ roomCode, answers }) => { if (games[normRoomCode(roomCode)]) io.to(normRoomCode(roomCode)).emit("spectator-estimate-reveal", { answers }); });

  // BUZZER & PUNKTE
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
      if (socketId) io.to(socketId).emit("you-are-locked");
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
    if (game.lockedPlayers.has(playerId)) { socket.emit("you-are-locked"); return; }
    const player = game.players[playerId];
    if (!player || player.connected === false) return;
    game.firstBuzzId = playerId;
    const teamId = player.teamId;
    const teamName = game.isTeamsMode && teamId ? game.teams[teamId]?.name : null;
    io.to(rc).emit("player-buzzed-first", { playerId, name: player.name, teamId: teamId || null, teamName });
    game.buzzingEnabled = false;
    io.to(rc).emit("buzzing-status", { enabled: false });
  });

  socket.on("host-update-score", ({ roomCode, playerId, delta }) => {
    const rc = normRoomCode(roomCode);
    const game = games[rc];
    if (!game || game.hostId !== socket.id) return;
    if (game.players[playerId]) {
      game.players[playerId].score += Number(delta || 0);
      if (game.isTeamsMode) { updateTeamScores(game); emitTeams(rc); }
      emitPlayers(rc);
    }
  });

  socket.on("board-update-score", ({ roomCode, playerId, delta }) => {
    const rc = normRoomCode(roomCode);
    const game = games[rc];
    if (!game) return;
    if (game.players[playerId]) {
      game.players[playerId].score += Number(delta || 0);
      if (game.isTeamsMode) { updateTeamScores(game); emitTeams(rc); }
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
    if (targetSocketId) io.to(targetSocketId).emit("you-are-locked");
  });

  socket.on("board-clear-locks", ({ roomCode }) => {
    const game = games[normRoomCode(roomCode)];
    if (!game) return;
    ensureLockedPlayers(game);
    game.lockedPlayers.clear();
    io.to(normRoomCode(roomCode)).emit("round-reset");
  });

  // SCHÄTZFRAGEN
  socket.on("board-estimate-start", ({ roomCode, question, timeLimit }) => {
    const rc = normRoomCode(roomCode);
    const game = games[rc];
    if (!game) return;
    const connectedIds = Object.entries(game.players).filter(([, p]) => p?.connected !== false).map(([pid]) => pid);
    game.estimateRound = { active: true, answers: {}, totalPlayers: connectedIds.length };
    io.to(rc).emit("estimate-question-started", { question, timeLimit });
    if (game.estimateRound.totalPlayers === 0) { game.estimateRound.active = false; io.to(rc).emit("estimate-all-answered"); io.to(rc).emit("estimate-locked"); }
  });

  socket.on("board-estimate-end", ({ roomCode }) => {
    const game = games[normRoomCode(roomCode)];
    if (!game) return;
    if (game.estimateRound) game.estimateRound.active = false;
    io.to(normRoomCode(roomCode)).emit("estimate-locked");
  });

  socket.on("estimate-answer", ({ roomCode, value, noAnswer }) => {
    const rc = normRoomCode(roomCode);
    const game = games[rc];
    if (!game) return;
    const round = game.estimateRound;
    if (!round?.active) return;
    const playerId = game.socketToPlayerId[socket.id] || socket.data.playerId;
    if (!playerId || !game.players[playerId]) return;
    const player = game.players[playerId];
    if (!player || player.connected === false) return;
    round.answers[playerId] = { name: player.name, value, noAnswer: !!noAnswer };
    io.to(rc).emit("estimate-answer-received-board", { playerId, name: player.name, value, noAnswer: !!noAnswer });
    if (Object.keys(round.answers).length >= round.totalPlayers) { round.active = false; io.to(rc).emit("estimate-all-answered"); io.to(rc).emit("estimate-locked"); }
  });

  // DISCONNECT
  socket.on("disconnect", () => {
    for (const [rc, game] of Object.entries(games)) {
      if (game.hostId === socket.id) { io.to(rc).emit("game-ended"); delete games[rc]; return; }
    }
    for (const [rc, game] of Object.entries(games)) { if (game.boardSocketId === socket.id) game.boardSocketId = null; }
    for (const [rc, game] of Object.entries(games)) { ensureSpectators(game); game.spectators.delete(socket.id); }
    if (socket.data.isLocalTeams && localTeamsGame) {
      const playerId = localTeamsGame.socketToPlayerId[socket.id];
      if (playerId && localTeamsGame.players[playerId]) {
        localTeamsGame.players[playerId].connected = false;
        delete localTeamsGame.socketToPlayerId[socket.id];
        io.emit("players-updated", localTeamsGame.players);
      }
      return;
    }
    const rc = socket.data.roomCode;
    const pid = socket.data.playerId;
    if (rc && pid) {
      const game = games[rc];
      if (game) {
        ensureCamPlayers(game);
        if (game.camPlayers.has(pid) && game.boardSocketId) io.to(game.boardSocketId).emit("cam-player-disconnected", { playerId: pid });
        if (game.players[pid]) {
          game.players[pid].connected = false;
          game.players[pid].socketId = null;
          delete game.socketToPlayerId?.[socket.id];
          emitPlayers(rc);
          if (game.isTeamsMode) emitTeams(rc);
          return;
        }
      }
    }
    for (const [roomCode, game] of Object.entries(games)) {
      const playerId = game.socketToPlayerId?.[socket.id];
      if (!playerId) continue;
      if (game.players[playerId]) { game.players[playerId].connected = false; game.players[playerId].socketId = null; }
      delete game.socketToPlayerId[socket.id];
      emitPlayers(roomCode);
      if (game.isTeamsMode) emitTeams(roomCode);
      return;
    }
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log("Server läuft auf Port " + PORT));
