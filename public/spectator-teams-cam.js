// public/spectator-teams-cam.js
// Online-Spieler MIT KAMERA für Jeopardy Teams Modus

const socket = io();

// ===============================
// DOM Elements
// ===============================
const joinPage          = document.getElementById("joinPage");
const roomCodeInput     = document.getElementById("spectatorRoomCode");
const nameInput         = document.getElementById("spectatorName");
const teamSelectGrid    = document.getElementById("teamSelectGrid");
const joinBtn           = document.getElementById("spectatorJoinBtn");
const joinStatus        = document.getElementById("spectatorJoinStatus");

const mainPage          = document.getElementById("spectatorMainPage");
const teamsBar          = document.getElementById("teamsBar");
const buzzerBtn         = document.getElementById("spectatorBuzzBtn");
const boardEl           = document.getElementById("board");
const turnIndicatorEl   = document.getElementById("turnIndicator");

// Kamera
const localVideoJoin    = document.getElementById("localVideoJoin");
const localVideoPip     = document.getElementById("localVideoPip");
const camPip            = document.getElementById("camPip");
const camPlaceholder    = document.getElementById("camPlaceholder");
const camPipLabel       = document.getElementById("camPipLabel");

// Question
const overlayEl                = document.getElementById("questionOverlay");
const questionCardEl           = document.getElementById("questionCard");
const questionPointsInnerEl    = document.querySelector("#questionPoints .points-inner");
const questionTextEl           = document.getElementById("questionText");
const answerTextEl             = document.getElementById("answerText");
const buzzInfoEl               = document.getElementById("buzzInfo");
const qMediaEl                 = document.getElementById("qMedia");
const qImageEl                 = document.getElementById("qImage");
const lightboxEl               = document.getElementById("lightbox");
const lightboxImgEl            = document.getElementById("lightboxImg");
const lightboxCloseEl          = document.getElementById("lightboxClose");
const estimateRevealContainer  = document.getElementById("estimateRevealContainer");
const estimateRevealList       = document.getElementById("estimateRevealList");
const estimateModal            = document.getElementById("estimateModal");
const estimateQuestionTextEl   = document.getElementById("estimateQuestionText");
const estimateInput            = document.getElementById("estimateInput");
const estimateTimerEl          = document.getElementById("estimateTimer");
const estimateStatusEl         = document.getElementById("estimateStatus");
const sendEstimateBtn          = document.getElementById("sendEstimateBtn");

// ===============================
// Audio
// ===============================
const sfxBuzz    = new Audio("/sounds/buzzer-button.wav");
const sfxCorrect = new Audio("/sounds/correct-sound.wav");
const sfxWrong   = new Audio("/sounds/wrong-sound.wav");
[sfxBuzz, sfxCorrect, sfxWrong].forEach(s => s.preload = "auto");
function safePlay(s) { s.currentTime = 0; s.play().catch(() => {}); }

// ===============================
// State
// ===============================
let currentRoomCode  = null;
let selectedTeamId   = null;
let playerId         = null;
let joined           = false;
let buzzingEnabled   = false;
let isLocked         = false;

let teams            = {};
let players          = {};
let activeTeamId     = null;
let currentRound     = 1;
let usedCells        = new Set();

// Kamera
let localStream      = null;
let boardSocketId    = null;
const peerConnections = {};

// Estimate
let estimateLocked      = false;
let estimateDeadline    = null;
let estimateTimerInterval = null;

// ===============================
// Categories
// ===============================
const categoriesRound1 = [
  { name: "தமிழ் சினிமா",       questions: [100,200,300,400,500].map(v => ({value:v})) },
  { name: "தமிழ் பண்பாடு",      questions: [100,200,300,400,500].map(v => ({value:v})) },
  { name: "தமிழ் உணவு",          questions: [100,200,300,400,500].map(v => ({value:v})) },
  { name: "யார் இது?",           questions: [100,200,300,400,500].map(v => ({value:v})) },
  { name: "மதிப்பீடு",           questions: [100,200,300,400,500].map(v => ({value:v})) },
];
const categoriesRound2 = [
  { name: "பொது அறிவு",          questions: [100,200,300,400,500].map(v => ({value:v})) },
  { name: "தமிழ்நாடு",           questions: [100,200,300,400,500].map(v => ({value:v})) },
  { name: "விளையாட்டு & உலகம்", questions: [100,200,300,400,500].map(v => ({value:v})) },
  { name: "யார்/என்ன இது?",      questions: [100,200,300,400,500].map(v => ({value:v})) },
  { name: "மதிப்பீடு",           questions: [100,200,300,400,500].map(v => ({value:v})) },
];

// ===============================
// Kamera initialisieren
// ===============================
async function initCamera() {
  try {
    localStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
    if (localVideoJoin) {
      localVideoJoin.srcObject = localStream;
      if (camPlaceholder) camPlaceholder.style.display = "none";
    }
  } catch (err) {
    console.warn("Kamera nicht verfügbar:", err);
    if (camPlaceholder) camPlaceholder.innerHTML = '<span class="cam-placeholder-icon">🚫</span><span>Kamera nicht erlaubt</span>';
  }
}

function startPip(name) {
  if (!localStream || !localVideoPip || !camPip) return;
  localVideoPip.srcObject = localStream;
  if (camPipLabel) camPipLabel.textContent = name || "Ich";
  camPip.classList.add("visible");
}

// ===============================
// WebRTC — an Board streamen
// ===============================
async function connectToBoard(targetSocketId) {
  if (!localStream || !targetSocketId) return;
  if (peerConnections[targetSocketId]) return;

  const pc = new RTCPeerConnection({ iceServers: [{ urls: "stun:stun.l.google.com:19302" }] });
  peerConnections[targetSocketId] = pc;

  localStream.getTracks().forEach(track => pc.addTrack(track, localStream));

  pc.onicecandidate = (e) => {
    if (e.candidate && currentRoomCode) {
      socket.emit("webrtc-ice-candidate", {
        roomCode: currentRoomCode,
        targetId: targetSocketId,
        candidate: e.candidate,
        streamType: "player",
        fromPlayerId: playerId,
      });
    }
  };

  const offer = await pc.createOffer();
  await pc.setLocalDescription(offer);
  socket.emit("webrtc-offer", {
    roomCode: currentRoomCode,
    targetId: targetSocketId,
    offer,
    streamType: "player",
    playerId,
  });
}

// ===============================
// Build Board
// ===============================
function buildBoard() {
  if (!boardEl) return;
  boardEl.innerHTML = "";
  const cats = currentRound >= 2 ? categoriesRound2 : categoriesRound1;
  const multiplier = currentRound >= 2 ? 2 : 1;
  cats.forEach(cat => {
    const h = document.createElement("div");
    h.className = "board-category";
    h.textContent = cat.name;
    boardEl.appendChild(h);
  });
  for (let qi = 0; qi < 5; qi++) {
    cats.forEach((cat, ci) => {
      const cell = document.createElement("button");
      cell.className = "board-cell";
      cell.textContent = cat.questions[qi].value * multiplier;
      cell.dataset.categoryIndex = ci;
      cell.dataset.questionIndex = qi;
      cell.disabled = true;
      if (usedCells.has(`${ci}-${qi}`)) cell.classList.add("board-cell-used");
      boardEl.appendChild(cell);
    });
  }
}

// ===============================
// Team Selection (Join)
// ===============================
function renderTeamSelection() {
  if (!teamSelectGrid) return;
  const entries = Object.entries(teams);
  if (entries.length === 0) {
    teamSelectGrid.innerHTML = '<div class="no-teams-msg">Noch keine Teams vorhanden</div>';
    return;
  }
  teamSelectGrid.innerHTML = entries.map(([tid, team]) => {
    const count    = (team.members || []).length;
    const selected = (selectedTeamId === tid || window.selectedTeamId === tid) ? "selected" : "";
    return `
      <div class="team-option team-${team.colorId || 'blue'} ${selected}" data-team-id="${tid}">
        <div class="team-option-name">${team.name}</div>
        <div class="team-option-count">${count} Spieler</div>
      </div>`;
  }).join("");
  teamSelectGrid.querySelectorAll(".team-option").forEach(el => {
    el.addEventListener("click", () => {
      selectedTeamId = el.dataset.teamId;
      window.selectedTeamId = el.dataset.teamId;
      renderTeamSelection();
      if (typeof window.updateJoinBtn === 'function') window.updateJoinBtn();
    });
  });
}

function updateJoinBtn() {
  if (typeof window.updateJoinBtn === 'function') { window.updateJoinBtn(); return; }
  const code = roomCodeInput?.value?.trim();
  const name = nameInput?.value?.trim();
  if (joinBtn) joinBtn.disabled = !(code && code.length >= 3 && name && selectedTeamId);
}

roomCodeInput?.addEventListener("input", function() {
  this.value = this.value.toUpperCase();
  const rc = this.value.trim();
  if (rc.length >= 3) socket.emit("request-teams", { roomCode: rc });
  else { teams = {}; renderTeamSelection(); }
});

// ===============================
// Join
// ===============================
joinBtn?.addEventListener("click", doJoin);
nameInput?.addEventListener("keydown", (e) => { if (e.key === "Enter" && !joinBtn?.disabled) doJoin(); });

function doJoin() {
  const rc    = roomCodeInput?.value?.trim().toUpperCase();
  const nm    = nameInput?.value?.trim();
  const tab   = window.getCurrentTab?.() || 'join';
  const color = window.getSelectedColor?.() || 'red';

  if (!rc || !nm) return;
  currentRoomCode = rc;
  if (joinStatus) joinStatus.textContent = "";

  if (tab === 'create') {
    const teamName = document.getElementById("newTeamName")?.value.trim();
    if (!teamName) return;
    socket.emit("teams-create-team", { roomCode: rc, name: teamName, colorId: color });
    // Warte auf teams-updated, dann join
    socket.once("teams-updated", () => {
      const teamId = teamName.trim().toLowerCase().replace(/\s+/g, "-");
      joinAsPlayer(rc, nm, teamId);
    });
  } else {
    if (!selectedTeamId) return;
    joinAsPlayer(rc, nm, selectedTeamId);
  }
}

function joinAsPlayer(rc, nm, teamId) {
  socket.emit("player-join-teams", { roomCode: rc, name: nm, teamId, hasCamera: true }, (res) => {
    if (res?.success) {
      playerId = res.playerId;
      joined   = true;

      if (joinPage)  joinPage.style.display = "none";
      if (mainPage)  mainPage.classList.add("visible");
      if (teamsBar)  teamsBar.style.display = "flex";

      buildBoard();
      renderTeamsBar();
      updateBuzzerIndicator();
      startPip(nm);

      socket.emit("spectator-join-room", { roomCode: rc, hasCamera: true });

      // Kamera ans Board melden
      if (localStream) {
        socket.emit("cam-player-ready", { roomCode: rc, playerId: res.playerId });
      }
    } else {
      if (joinStatus) joinStatus.textContent = res?.error || "Fehler beim Beitreten";
    }
  });
}

// ===============================
// Teams Bar
// ===============================
function renderTeamsBar() {
  if (!teamsBar) return;
  const entries = Object.entries(teams);
  if (entries.length === 0) { teamsBar.innerHTML = ""; return; }
  teamsBar.innerHTML = entries.map(([tid, team]) => {
    const isActive = activeTeamId === tid;
    const members  = (team.members || []).map(pid => {
      const p = players[pid];
      if (!p) return null;
      const cls = p.connected === false ? "offline" : "";
      return `<span class="team-member"><span class="member-dot ${cls}"></span>${p.name}</span>`;
    }).filter(Boolean).join("");
    return `
      <div class="team-card team-${team.colorId || 'blue'} ${isActive ? 'team-active' : ''}">
        <div class="team-card-header"><span class="team-color-dot"></span><span class="team-card-name">${team.name}</span></div>
        <div class="team-card-score">${team.score || 0} Punkte</div>
        <div class="team-card-members">${members || "—"}</div>
      </div>`;
  }).join("");
}

// ===============================
// Buzzer
// ===============================
function updateBuzzerIndicator() {
  if (!buzzerBtn) return;
  if (!joined) { buzzerBtn.classList.add("hidden"); return; }
  buzzerBtn.classList.remove("hidden");
  if (isLocked || !buzzingEnabled) {
    buzzerBtn.classList.remove("buzzer-active");
    buzzerBtn.innerHTML = "BUZZER<br>GESPERRT";
    buzzerBtn.disabled = true;
  } else {
    buzzerBtn.classList.add("buzzer-active");
    buzzerBtn.innerHTML = "BUZZER<br>FREI";
    buzzerBtn.disabled = false;
  }
}

function doBuzz() {
  if (!joined || !currentRoomCode || !buzzingEnabled || isLocked) return;
  safePlay(sfxBuzz);
  socket.emit("player-buzz", { roomCode: currentRoomCode });
  buzzingEnabled = false;
  updateBuzzerIndicator();
}

buzzerBtn?.addEventListener("click", doBuzz);
document.addEventListener("keydown", (e) => {
  if (e.code !== "Space") return;
  const t = e.target;
  if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA")) return;
  if (!joined) return;
  e.preventDefault(); doBuzz();
});

// ===============================
// Lightbox
// ===============================
function openLightbox(src) { if (!lightboxEl) return; lightboxImgEl.src = src; lightboxEl.classList.remove("hidden"); }
function closeLightbox()   { lightboxEl?.classList.add("hidden"); }
lightboxCloseEl?.addEventListener("click", closeLightbox);
lightboxEl?.addEventListener("click", (e) => { if (e.target === lightboxEl) closeLightbox(); });
qImageEl?.addEventListener("click", () => { if (qImageEl.src) openLightbox(qImageEl.src); });

// ===============================
// Flash
// ===============================
function flashScreen(type) {
  const flash = document.getElementById("screenFlash");
  if (!flash) return;
  flash.classList.remove("flash-correct", "flash-wrong");
  void flash.offsetWidth;
  flash.classList.add(type === "correct" ? "flash-correct" : "flash-wrong");
  setTimeout(() => flash.classList.remove("flash-correct", "flash-wrong"), 400);
}

// ===============================
// Estimate
// ===============================
function startEstimateTimer() {
  stopEstimateTimer();
  estimateTimerInterval = setInterval(() => {
    if (!estimateDeadline) return;
    const left = Math.max(0, Math.ceil((estimateDeadline - Date.now()) / 1000));
    if (estimateTimerEl) estimateTimerEl.textContent = left;
    if (left <= 0) stopEstimateTimer();
  }, 250);
}
function stopEstimateTimer() {
  if (estimateTimerInterval) clearInterval(estimateTimerInterval);
  estimateTimerInterval = null;
}

sendEstimateBtn?.addEventListener("click", () => {
  if (estimateLocked || !currentRoomCode) return;
  const val = estimateInput?.value?.trim();
  socket.emit("estimate-answer", { roomCode: currentRoomCode, value: val });
  estimateLocked = true;
  if (estimateInput) estimateInput.disabled = true;
  if (sendEstimateBtn) sendEstimateBtn.disabled = true;
  if (estimateStatusEl) estimateStatusEl.textContent = "Antwort gesendet!";
});

// ===============================
// Socket Events
// ===============================
socket.on("teams-updated", (serverTeams) => {
  teams = serverTeams || {};
  if (!joined) renderTeamSelection();
  else renderTeamsBar();
});

socket.on("players-updated", (serverPlayers) => {
  players = serverPlayers || {};
  renderTeamsBar();
});

socket.on("buzzing-status", ({ enabled }) => {
  buzzingEnabled = !!enabled;
  if (enabled) { activeTeamId = null; renderTeamsBar(); if (buzzInfoEl) { buzzInfoEl.textContent = ""; buzzInfoEl.classList.add("hidden"); } }
  updateBuzzerIndicator();
});

socket.on("you-are-locked", () => { isLocked = true; updateBuzzerIndicator(); });
socket.on("round-reset",     () => { isLocked = false; updateBuzzerIndicator(); });

socket.on("player-buzzed-first", ({ name, teamId, teamName }) => {
  activeTeamId = teamId; renderTeamsBar(); safePlay(sfxBuzz);
  buzzingEnabled = false; updateBuzzerIndicator();
  if (buzzInfoEl) { buzzInfoEl.textContent = `${name} (${teamName || "Team"}) hat gebuzzert!`; buzzInfoEl.classList.remove("hidden"); }
  if (questionCardEl) questionCardEl.classList.add("question-card-buzzed");
});

socket.on("spectator-question-opened", ({ categoryIndex, questionIndex, question, value, type, imageUrl }) => {
  if (questionPointsInnerEl) questionPointsInnerEl.textContent = value || "";
  if (questionTextEl) questionTextEl.textContent = question || "";
  if (answerTextEl)   { answerTextEl.textContent = ""; answerTextEl.classList.add("hidden"); }
  if (type === "image" && imageUrl && qMediaEl && qImageEl) { qImageEl.src = imageUrl; qMediaEl.classList.remove("hidden"); }
  else qMediaEl?.classList.add("hidden");
  if (buzzInfoEl) { buzzInfoEl.textContent = ""; buzzInfoEl.classList.add("hidden"); }
  if (questionCardEl) questionCardEl.classList.remove("question-card-buzzed");
  if (estimateRevealContainer) estimateRevealContainer.classList.add("hidden");
  overlayEl?.classList.remove("hidden");
});

socket.on("spectator-answer-shown", ({ answer }) => {
  if (answerTextEl) { answerTextEl.textContent = answer || ""; answerTextEl.classList.remove("hidden"); }
  closeLightbox();
});

socket.on("spectator-question-closed", ({ categoryIndex, questionIndex }) => {
  usedCells.add(`${categoryIndex}-${questionIndex}`);
  const cell = boardEl?.querySelector(`[data-category-index="${categoryIndex}"][data-question-index="${questionIndex}"]`);
  if (cell) { cell.classList.remove("board-cell-active"); cell.classList.add("board-cell-used"); }
  overlayEl?.classList.add("hidden");
  activeTeamId = null; renderTeamsBar();
  if (buzzInfoEl) { buzzInfoEl.textContent = ""; buzzInfoEl.classList.add("hidden"); }
  if (questionCardEl) questionCardEl.classList.remove("question-card-buzzed");
  closeLightbox(); qMediaEl?.classList.add("hidden");
});

socket.on("spectator-correct", () => { safePlay(sfxCorrect); flashScreen("correct"); });
socket.on("spectator-wrong",   () => { safePlay(sfxWrong);   flashScreen("wrong"); });

socket.on("spectator-round-changed", ({ round }) => { currentRound = round; usedCells.clear(); buildBoard(); });

socket.on("spectator-turn-update", ({ playerName }) => {
  if (turnIndicatorEl && playerName) turnIndicatorEl.textContent = `⭐ ${playerName} ist dran ⭐`;
});

socket.on("estimate-question-started", ({ question, timeLimit }) => {
  if (!joined) return;
  estimateLocked = false;
  if (estimateQuestionTextEl) estimateQuestionTextEl.textContent = question || "";
  if (estimateInput) { estimateInput.value = ""; estimateInput.disabled = false; }
  if (sendEstimateBtn) sendEstimateBtn.disabled = false;
  if (estimateStatusEl) estimateStatusEl.textContent = "";
  estimateDeadline = Date.now() + (timeLimit || 30) * 1000;
  startEstimateTimer();
  estimateModal?.classList.remove("hidden");
});

socket.on("estimate-locked", () => {
  estimateLocked = true;
  if (estimateInput) estimateInput.disabled = true;
  if (sendEstimateBtn) sendEstimateBtn.disabled = true;
  if (estimateStatusEl) estimateStatusEl.textContent = "Zeit abgelaufen!";
  stopEstimateTimer();
  estimateModal?.classList.add("hidden");
});

socket.on("spectator-estimate-reveal", ({ answers }) => {
  if (!estimateRevealContainer || !estimateRevealList) return;
  estimateRevealList.innerHTML = (answers || []).map(a => {
    const val = a.noAnswer ? "—" : a.value;
    return `<div class="estimate-reveal-item"><span class="estimate-name">${a.name}</span><span class="estimate-value">${val}</span></div>`;
  }).join("");
  estimateRevealContainer.classList.remove("hidden");
});

// ── WebRTC ──
socket.on("board-socket-id", ({ socketId }) => {
  boardSocketId = socketId;
  if (joined && localStream) connectToBoard(socketId);
});

socket.on("webrtc-request-offer", ({ fromId }) => {
  connectToBoard(fromId);
});

socket.on("webrtc-answer", async ({ fromId, answer }) => {
  const pc = peerConnections[fromId];
  if (pc) await pc.setRemoteDescription(new RTCSessionDescription(answer));
});

socket.on("webrtc-ice-candidate", async ({ fromId, candidate }) => {
  const pc = peerConnections[fromId];
  if (pc && candidate) await pc.addIceCandidate(new RTCIceCandidate(candidate));
});

socket.on("game-ended", () => {
  alert("Das Spiel wurde beendet.");
  window.location.href = "/jeopardy-teams.html";
});

socket.on("connect", () => {
  const rc = roomCodeInput?.value?.trim().toUpperCase();
  if (rc && rc.length >= 3) socket.emit("request-teams", { roomCode: rc });
});

// ═══════════════════════════════════════════
// HOST-STREAM EMPFANG
// ═══════════════════════════════════════════
const rtcConfig = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'turn:bamangames.metered.live:80', username: 'f0a80f469f8b8590832f8da3', credential: 'crkMbNXmiA79CgUn' }
  ]
};

let hostPC = null;

socket.on("webrtc-offer", async ({ fromId, offer, streamType }) => {
  if (streamType !== "host") return;
  
  if (hostPC) try { hostPC.close(); } catch {}
  hostPC = new RTCPeerConnection(rtcConfig);
  
  hostPC.ontrack = (e) => {
    if (hostCamVideo) {
      hostCamVideo.srcObject = e.streams[0];
      if (hostCamView) hostCamView.classList.add("visible");
    }
  };
  
  hostPC.onicecandidate = (e) => {
    if (e.candidate && currentRoomCode) {
      socket.emit("webrtc-ice-candidate", { roomCode: currentRoomCode, targetId: fromId, candidate: e.candidate, streamType: "host" });
    }
  };
  
  await hostPC.setRemoteDescription(new RTCSessionDescription(offer));
  const answer = await hostPC.createAnswer();
  await hostPC.setLocalDescription(answer);
  socket.emit("webrtc-answer", { roomCode: currentRoomCode, targetId: fromId, answer, streamType: "host" });
});

socket.on("webrtc-ice-candidate", async ({ candidate, streamType }) => {
  if (streamType === "host" && hostPC && candidate) {
    await hostPC.addIceCandidate(new RTCIceCandidate(candidate)).catch(() => {});
  }
});

// Host-Stream nach Join anfordern
socket.on("connect", () => {
  if (joined && currentRoomCode) {
    setTimeout(() => socket.emit("request-host-stream", { roomCode: currentRoomCode }), 1000);
  }
});
// ===============================
// Init
// ===============================
initCamera();
