// public/spectator-cam.js
// ═══════════════════════════════════════════════════════════
// SPECTATOR MIT KAMERA - Sendet eigene Cam an Board, empfängt Host-Cam
// ═══════════════════════════════════════════════════════════

const socket = io();

// ===============================
// WebRTC Config mit TURN Servern (Metered + Backup)
// ===============================
const rtcConfig = {
  iceServers: [
    // STUN Server
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun2.l.google.com:19302' },
    
    // Metered.ca TURN (Primary)
    {
      urls: 'turn:bamangames.metered.live:80',
      username: 'f0a80f469f8b8590832f8da3',
      credential: 'crkMbNXmiA79CgUn'
    },
    {
      urls: 'turn:bamangames.metered.live:80?transport=tcp',
      username: 'f0a80f469f8b8590832f8da3',
      credential: 'crkMbNXmiA79CgUn'
    },
    {
      urls: 'turn:bamangames.metered.live:443',
      username: 'f0a80f469f8b8590832f8da3',
      credential: 'crkMbNXmiA79CgUn'
    },
    {
      urls: 'turns:bamangames.metered.live:443',
      username: 'f0a80f469f8b8590832f8da3',
      credential: 'crkMbNXmiA79CgUn'
    },
    
    // OpenRelay TURN (Backup - öffentlich)
    {
      urls: 'turn:openrelay.metered.ca:80',
      username: 'openrelayproject',
      credential: 'openrelayproject'
    },
    {
      urls: 'turn:openrelay.metered.ca:443',
      username: 'openrelayproject',
      credential: 'openrelayproject'
    },
    {
      urls: 'turn:openrelay.metered.ca:443?transport=tcp',
      username: 'openrelayproject',
      credential: 'openrelayproject'
    }
  ],
  iceCandidatePoolSize: 10
};

// ===============================
// DOM Elements
// ===============================
const joinOverlay = document.getElementById("spectatorJoinOverlay");
const roomCodeInput = document.getElementById("spectatorRoomCode");
const nameInput = document.getElementById("spectatorName");
const joinBtn = document.getElementById("spectatorJoinBtn");
const joinStatus = document.getElementById("spectatorJoinStatus");
const camPreview = document.getElementById("camPreview");
const camPreviewStatus = document.getElementById("camPreviewStatus");
const mainPage = document.getElementById("spectatorMainPage");
const buzzerIndicator = document.getElementById("buzzerIndicator");
const buzzerText = document.getElementById("buzzerText");
const boardEl = document.getElementById("board");
const playersBarEl = document.getElementById("players-bar");
const turnIndicatorEl = document.getElementById("turnIndicator");
const overlayEl = document.getElementById("questionOverlay");
const questionPointsInnerEl = document.querySelector("#questionPoints .points-inner");
const questionTextEl = document.getElementById("questionText");
const answerTextEl = document.getElementById("answerText");
const buzzInfoEl = document.getElementById("buzzInfo");
const questionCardEl = document.getElementById("questionCard");
const qMediaEl = document.getElementById("qMedia");
const qImageEl = document.getElementById("qImage");
const lightboxEl = document.getElementById("lightbox");
const lightboxImgEl = document.getElementById("lightboxImg");
const lightboxCloseEl = document.getElementById("lightboxClose");
const estimateRevealContainer = document.getElementById("estimateRevealContainer");
const estimateRevealList = document.getElementById("estimateRevealList");
const estimateModal = document.getElementById("estimateModal");
const estimateQuestionTextEl = document.getElementById("estimateQuestionText");
const estimateInput = document.getElementById("estimateInput");
const estimateTimerEl = document.getElementById("estimateTimer");
const estimateStatusEl = document.getElementById("estimateStatus");
const sendEstimateBtn = document.getElementById("sendEstimateBtn");
const hostCamBox = document.getElementById("hostCamBox");
const hostCamVideo = document.getElementById("hostCamVideo");

// ===============================
// State
// ===============================
let currentRoomCode = null;
let currentName = null;
let myPlayerId = null;
let joined = false;
let buzzingEnabled = false;
let isLocked = false;
let localStream = null;
let cameraReady = false;

// WebRTC
let outgoingPC = null; // Meine Cam -> Board
let hostPC = null; // Host-Cam -> Mir

// Game State
let latestPlayers = {};
let activePlayerId = null;
let activePlayerName = null;
let currentRound = 1;
let usedCells = new Set();

// Estimate
let estimateActive = false;
let estimateLocked = false;
let estimateDeadline = null;
let estimateTimerInterval = null;

// ===============================
// Sounds
// ===============================
const sfxTick = new Audio("/sounds/tick.wav"); sfxTick.volume = 0.25;
const sfxBuzz = new Audio("/sounds/buzzer-button.wav");
const sfxCorrect = new Audio("/sounds/correct-button.wav");
const sfxWrong = new Audio("/sounds/wrong-button.wav");

function safePlay(a) { try { a.currentTime = 0; a.play().catch(() => {}); } catch {} }

// ===============================
// Screen Flash
// ===============================
function flashScreen(type) {
  const el = document.getElementById("screenFlash");
  if (!el) return;
  el.classList.remove("screen-flash-green", "screen-flash-red", "screen-flash-active");
  requestAnimationFrame(() => {
    if (type === "correct") el.classList.add("screen-flash-green");
    if (type === "wrong") el.classList.add("screen-flash-red");
    requestAnimationFrame(() => {
      el.classList.add("screen-flash-active");
      setTimeout(() => el.classList.remove("screen-flash-active", "screen-flash-green", "screen-flash-red"), 350);
    });
  });
}

// ===============================
// LocalStorage
// ===============================
function saveJoin(room, name) {
  try { localStorage.setItem("jt_cam_room", room); localStorage.setItem("jt_cam_name", name); } catch {}
}
function loadJoin() {
  try { return { room: localStorage.getItem("jt_cam_room") || "", name: localStorage.getItem("jt_cam_name") || "" }; } catch { return { room: "", name: "" }; }
}

function setJoinStatus(msg, err = false) {
  if (joinStatus) { joinStatus.textContent = msg; joinStatus.style.color = err ? "#f97316" : "#2dd4bf"; }
}

// ===============================
// Eigene Kamera
// ===============================
async function initCamera() {
  try {
    if (camPreviewStatus) camPreviewStatus.textContent = "Kamera wird geladen...";
    localStream = await navigator.mediaDevices.getUserMedia({
      video: { width: { ideal: 320 }, height: { ideal: 240 }, facingMode: "user" },
      audio: false
    });
    if (camPreview) { camPreview.srcObject = localStream; camPreview.classList.add("active"); }
    if (camPreviewStatus) { camPreviewStatus.textContent = "✅ Bereit!"; camPreviewStatus.style.color = "#22c55e"; }
    cameraReady = true;
    return true;
  } catch (err) {
    console.error("Camera error:", err);
    if (camPreviewStatus) {
      camPreviewStatus.textContent = err.name === "NotAllowedError" ? "❌ Verweigert" : "❌ Keine Kamera";
      camPreviewStatus.style.color = "#ef4444";
    }
    cameraReady = false;
    return false;
  }
}

// ===============================
// WebRTC: Meine Cam -> Board
// ===============================
function createOutgoingPC(targetId) {
  if (outgoingPC) {
    try { outgoingPC.close(); } catch {}
  }

  const pc = new RTCPeerConnection(rtcConfig);
  outgoingPC = pc;

  // Lokale Tracks hinzufügen
  if (localStream) {
    const tracks = localStream.getTracks();
    console.log("📹 Füge", tracks.length, "Tracks hinzu");
    tracks.forEach(track => {
      console.log("  - Track:", track.kind, track.label, "enabled:", track.enabled);
      pc.addTrack(track, localStream);
    });
  } else {
    console.log("⚠️ Kein localStream beim PC erstellen!");
  }

  pc.onicecandidate = (e) => {
    if (e.candidate && currentRoomCode) {
      socket.emit("webrtc-ice-candidate", {
        roomCode: currentRoomCode,
        targetId: targetId,
        candidate: e.candidate,
        streamType: "player"
      });
    } else if (!e.candidate) {
      console.log("🧊 ICE gathering complete");
    }
  };

  pc.onconnectionstatechange = () => {
    console.log(`🔌 Meine Cam -> Board: ${pc.connectionState}`);
    if (pc.connectionState === "connected") {
      console.log("✅ Stream-Verbindung zum Board erfolgreich!");
      streamSentToBoard = true;
    }
    if (pc.connectionState === "failed") {
      console.log("❌ Stream-Verbindung zum Board fehlgeschlagen!");
      streamSentToBoard = false;
      // Versuche erneut nach 2s
      if (connectionAttempts < MAX_ATTEMPTS) {
        setTimeout(() => connectToBoard(), 2000);
      }
    }
    if (pc.connectionState === "disconnected") {
      console.log("⚠️ Verbindung zum Board unterbrochen");
      streamSentToBoard = false;
    }
  };
  
  pc.oniceconnectionstatechange = () => {
    console.log(`🧊 ICE -> Board: ${pc.iceConnectionState}`);
    if (pc.iceConnectionState === "failed") {
      console.log("🧊 ICE fehlgeschlagen, versuche ICE restart...");
      pc.restartIce();
    }
  };

  return pc;
}

async function sendOfferToBoard(targetBoardSocketId) {
  if (!localStream) {
    console.log("⚠️ Kein localStream vorhanden!");
    return;
  }

  console.log("📤 Erstelle Verbindung zum Board:", targetBoardSocketId);
  const pc = createOutgoingPC(targetBoardSocketId);

  try {
    const offer = await pc.createOffer();
    console.log("✅ Offer erstellt");
    await pc.setLocalDescription(offer);
    console.log("✅ Local Description gesetzt");

    socket.emit("webrtc-offer", {
      roomCode: currentRoomCode,
      targetId: targetBoardSocketId,
      offer: pc.localDescription,
      streamType: "player",
      playerId: myPlayerId
    });
    console.log("📤 Offer an Board gesendet, playerId:", myPlayerId);
    streamSentToBoard = true;
  } catch (err) {
    console.error("❌ Offer error:", err);
    streamSentToBoard = false;
  }
}

// ===============================
// WebRTC: Host-Cam empfangen
// ===============================
function createHostPC(hostSocketId) {
  if (hostPC) {
    try { hostPC.close(); } catch {}
  }

  const pc = new RTCPeerConnection(rtcConfig);
  hostPC = pc;

  pc.ontrack = (event) => {
    console.log("📹 Host-Cam empfangen!");
    if (hostCamVideo) {
      hostCamVideo.srcObject = event.streams[0];
    }
    if (hostCamBox) {
      hostCamBox.classList.remove("hidden");
    }
  };

  pc.onicecandidate = (e) => {
    if (e.candidate && currentRoomCode) {
      socket.emit("webrtc-ice-candidate", {
        roomCode: currentRoomCode,
        targetId: hostSocketId,
        candidate: e.candidate,
        streamType: "host"
      });
    }
  };

  pc.onconnectionstatechange = () => {
    console.log(`Host-Cam: ${pc.connectionState}`);
    if (pc.connectionState === "failed" || pc.connectionState === "disconnected") {
      if (hostCamBox) hostCamBox.classList.add("hidden");
    }
  };

  return pc;
}

async function handleHostOffer(hostSocketId, offer) {
  console.log("Host-Offer empfangen");
  const pc = createHostPC(hostSocketId);

  try {
    await pc.setRemoteDescription(new RTCSessionDescription(offer));
    const answer = await pc.createAnswer();
    await pc.setLocalDescription(answer);

    socket.emit("webrtc-answer", {
      roomCode: currentRoomCode,
      targetId: hostSocketId,
      answer: pc.localDescription,
      streamType: "host"
    });
  } catch (err) {
    console.error("Host offer handling error:", err);
  }
}

// ===============================
// ICE Candidates
// ===============================
async function handleIceCandidate(fromId, candidate, streamType) {
  let pc;
  if (streamType === "host") {
    pc = hostPC;
  } else {
    pc = outgoingPC;
  }
  if (!pc) return;

  try {
    await pc.addIceCandidate(new RTCIceCandidate(candidate));
  } catch (err) {
    console.error("ICE error:", err);
  }
}

// ===============================
// Buzzer Indicator
// ===============================
function updateBuzzerIndicator() {
  if (!buzzerIndicator || !buzzerText) return;
  if (!joined) { buzzerIndicator.classList.add("hidden"); return; }
  buzzerIndicator.classList.remove("hidden");
  if (isLocked || !buzzingEnabled) {
    buzzerIndicator.classList.add("buzzer-locked");
    buzzerIndicator.classList.remove("buzzer-free");
    buzzerText.textContent = "GESPERRT";
  } else {
    buzzerIndicator.classList.remove("buzzer-locked");
    buzzerIndicator.classList.add("buzzer-free");
    buzzerText.textContent = "BUZZER FREI";
  }
}

// ===============================
// Board
// ===============================
const categoriesR1 = [
  { name: "Geographie", questions: [100,200,300,400,500].map(v => ({value:v})) },
  { name: "Filme & Serien", questions: [100,200,300,400,500].map(v => ({value:v})) },
  { name: "Musik", questions: [100,200,300,400,500].map(v => ({value:v})) },
  { name: "Wer ist das?", questions: [100,200,300,400,500].map(v => ({value:v})) },
  { name: "Schätzfragen", questions: [100,200,300,400,500].map(v => ({value:v})) },
];
const categoriesR2 = [
  { name: "Sport", questions: [100,200,300,400,500].map(v => ({value:v})) },
  { name: "Wissenschaft & Tech", questions: [100,200,300,400,500].map(v => ({value:v})) },
  { name: "Allgemeinwissen", questions: [100,200,300,400,500].map(v => ({value:v})) },
  { name: "Wer oder Was?", questions: [100,200,300,400,500].map(v => ({value:v})) },
  { name: "Schätzfragen", questions: [100,200,300,400,500].map(v => ({value:v})) },
];

function getCategories() { return currentRound >= 2 ? categoriesR2 : categoriesR1; }
function getMult() { return currentRound >= 2 ? 2 : 1; }

function buildBoard() {
  if (!boardEl) return;
  boardEl.innerHTML = "";
  const cats = getCategories();
  const mult = getMult();
  cats.forEach((cat, ci) => {
    const col = document.createElement("div");
    col.className = "board-column";
    const header = document.createElement("div");
    header.className = "board-category";
    header.textContent = cat.name;
    col.appendChild(header);
    cat.questions.forEach((q, qi) => {
      const cell = document.createElement("div");
      cell.className = "board-cell spectator-cell";
      cell.textContent = q.value * mult;
      cell.dataset.categoryIndex = ci;
      cell.dataset.questionIndex = qi;
      if (usedCells.has(`${ci}-${qi}`)) cell.classList.add("board-cell-used");
      col.appendChild(cell);
    });
    boardEl.appendChild(col);
  });
}

// ===============================
// Players Bar (eigene Cam integriert)
// ===============================
function renderPlayersBar() {
  if (!playersBarEl) return;
  const entries = Object.entries(latestPlayers || {});
  playersBarEl.innerHTML = "";

  if (entries.length === 0) {
    playersBarEl.innerHTML = '<div class="players-empty">Noch keine Spieler.</div>';
    return;
  }

  entries.forEach(([id, player]) => {
    const pill = document.createElement("div");
    pill.className = "player-pill";

    const videoWrap = document.createElement("div");
    videoWrap.className = "player-video-wrap";

    const placeholder = document.createElement("div");
    placeholder.className = "player-video-placeholder";
    placeholder.textContent = (player.name?.charAt(0) || "?").toUpperCase();

    const video = document.createElement("video");
    video.className = "player-video";
    video.autoplay = true;
    video.muted = true;
    video.playsInline = true;

    // EIGENE Cam anzeigen
    if (id === myPlayerId && localStream) {
      video.srcObject = localStream;
      placeholder.style.display = "none";
      pill.classList.add("is-self");
    } else {
      video.classList.add("hidden");
    }

    videoWrap.appendChild(placeholder);
    videoWrap.appendChild(video);

    const info = document.createElement("div");
    info.className = "player-info";
    const name = document.createElement("span");
    name.className = "player-name";
    name.textContent = player.name || "(Unbekannt)";
    const score = document.createElement("span");
    score.className = "player-score";
    score.textContent = `${player.score ?? 0} Pkt`;
    info.appendChild(name);
    info.appendChild(score);

    pill.appendChild(videoWrap);
    pill.appendChild(info);

    if (id === activePlayerId) pill.classList.add("player-pill-active");

    playersBarEl.appendChild(pill);
  });
}

// ===============================
// Lightbox
// ===============================
function openLightbox(src) { if (lightboxEl && lightboxImgEl) { lightboxImgEl.src = src; lightboxEl.classList.remove("hidden"); } }
function closeLightbox() { if (lightboxEl) { lightboxEl.classList.add("hidden"); if (lightboxImgEl) lightboxImgEl.src = ""; } }
if (qImageEl) qImageEl.addEventListener("click", () => { if (qImageEl.src) openLightbox(qImageEl.src); });
if (lightboxEl) lightboxEl.addEventListener("click", closeLightbox);
if (lightboxCloseEl) lightboxCloseEl.addEventListener("click", closeLightbox);

// ===============================
// Join
// ===============================
function doJoin(roomCode, name) {
  const rc = (roomCode || "").trim().toUpperCase();
  const nm = (name || "").trim();
  if (!rc || !nm) { setJoinStatus("Bitte Raumcode und Namen eingeben.", true); return; }
  if (!cameraReady) { setJoinStatus("Kamera muss aktiv sein!", true); return; }

  socket.emit("player-join", { roomCode: rc, name: nm, hasCamera: true }, (res) => {
    if (!res?.success) { setJoinStatus(res?.error || "Fehler", true); return; }
    currentRoomCode = rc;
    currentName = nm;
    myPlayerId = res.playerId || socket.id;
    joined = true;
    saveJoin(rc, nm);
    if (joinOverlay) joinOverlay.classList.add("hidden");
    if (mainPage) mainPage.classList.remove("hidden");
    updateBuzzerIndicator();

    // Als Spectator joinen
    socket.emit("spectator-join-room", { roomCode: rc, hasCamera: true });

    // Cam bereit melden
    socket.emit("cam-player-ready", { roomCode: rc, playerId: myPlayerId });

    // Host-Stream anfragen
    socket.emit("request-host-stream", { roomCode: rc });
    
    // Board Socket-ID anfragen (um Stream zu senden)
    socket.emit("request-board-socket-id", { roomCode: rc });
  });
}

if (joinBtn) joinBtn.addEventListener("click", () => doJoin(roomCodeInput?.value, nameInput?.value));
[roomCodeInput, nameInput].forEach(el => el?.addEventListener("keydown", e => { if (e.key === "Enter") joinBtn?.click(); }));

// ===============================
// Buzzer (Space + Touch/Click)
// ===============================
function triggerBuzz() {
  if (!joined || !currentRoomCode || !buzzingEnabled || isLocked) return;
  if (buzzerIndicator) { 
    buzzerIndicator.classList.add("buzzer-pressed"); 
    setTimeout(() => buzzerIndicator.classList.remove("buzzer-pressed"), 150); 
  }
  socket.emit("player-buzz", { roomCode: currentRoomCode });
  buzzingEnabled = false;
  updateBuzzerIndicator();
  
  // Vibration feedback auf Handy
  if (navigator.vibrate) navigator.vibrate(50);
}

// Space-Taste
document.addEventListener("keydown", (e) => {
  if (e.code !== "Space") return;
  const t = e.target;
  if (t?.tagName === "INPUT" || t?.tagName === "TEXTAREA") return;
  e.preventDefault();
  triggerBuzz();
});

// Touch/Click auf Buzzer-Indicator
if (buzzerIndicator) {
  buzzerIndicator.addEventListener("click", (e) => {
    e.preventDefault();
    triggerBuzz();
  });
  
  // Prevent double-tap zoom auf Mobile
  buzzerIndicator.addEventListener("touchend", (e) => {
    e.preventDefault();
    triggerBuzz();
  });
}

// ===============================
// Estimate Modal
// ===============================
let lastTickSec = null;

function openEstimateModal(question, timeLimit) {
  estimateActive = true; estimateLocked = false;
  if (estimateQuestionTextEl) estimateQuestionTextEl.textContent = question || "";
  if (estimateInput) { estimateInput.value = ""; estimateInput.disabled = false; }
  if (sendEstimateBtn) sendEstimateBtn.disabled = false;
  if (estimateStatusEl) estimateStatusEl.textContent = "";
  estimateDeadline = Date.now() + (timeLimit || 30) * 1000;
  lastTickSec = null;
  if (estimateTimerEl) estimateTimerEl.classList.remove("is-warning", "is-danger");
  updateEstimateTimer();
  if (estimateTimerInterval) clearInterval(estimateTimerInterval);
  estimateTimerInterval = setInterval(updateEstimateTimer, 200);
  if (estimateModal) { estimateModal.classList.remove("hidden"); estimateModal.classList.add("estimate-slide-in"); }
}

function closeEstimateModal() {
  estimateActive = false;
  if (estimateTimerInterval) clearInterval(estimateTimerInterval);
  if (estimateModal) { estimateModal.classList.add("hidden"); estimateModal.classList.remove("estimate-slide-in"); }
}

function updateEstimateTimer() {
  if (!estimateDeadline || !estimateTimerEl) return;
  const sec = Math.max(0, Math.ceil((estimateDeadline - Date.now()) / 1000));
  estimateTimerEl.classList.remove("is-warning", "is-danger");
  if (sec <= 5 && sec > 3) estimateTimerEl.classList.add("is-warning");
  if (sec <= 3 && sec > 0) estimateTimerEl.classList.add("is-danger");
  if (sec <= 3 && sec > 0 && lastTickSec !== sec) { lastTickSec = sec; safePlay(sfxTick); }
  if (sec > 0) { estimateTimerEl.textContent = sec + "s"; return; }
  estimateTimerEl.textContent = "0s";
  if (estimateTimerInterval) clearInterval(estimateTimerInterval);
  if (!estimateLocked) {
    estimateLocked = true;
    if (estimateInput) estimateInput.disabled = true;
    if (sendEstimateBtn) sendEstimateBtn.disabled = true;
    if (estimateStatusEl && !estimateStatusEl.textContent) estimateStatusEl.textContent = "Zeit abgelaufen.";
    socket.emit("estimate-answer", { roomCode: currentRoomCode, value: null, noAnswer: true });
  }
  setTimeout(closeEstimateModal, 600);
}

if (sendEstimateBtn) {
  sendEstimateBtn.addEventListener("click", () => {
    if (!estimateActive || estimateLocked) return;
    const raw = (estimateInput?.value || "").trim();
    let value = null;
    if (raw !== "") {
      value = Number(raw.replace(/'/g, "").replace(/,/g, "."));
      if (!Number.isFinite(value)) { if (estimateStatusEl) estimateStatusEl.textContent = "Ungültige Zahl."; return; }
    }
    socket.emit("estimate-answer", { roomCode: currentRoomCode, value, noAnswer: value === null });
    estimateLocked = true;
    if (estimateInput) estimateInput.disabled = true;
    if (sendEstimateBtn) sendEstimateBtn.disabled = true;
    if (estimateStatusEl) estimateStatusEl.textContent = "✅ Gespeichert.";
  });
}
if (estimateInput) estimateInput.addEventListener("keydown", e => { if (e.key === "Enter") sendEstimateBtn?.click(); });

// ===============================
// Socket Events
// ===============================

// Buzzer
socket.on("buzzing-status", ({ enabled }) => { buzzingEnabled = !!enabled; updateBuzzerIndicator(); });
socket.on("you-are-locked", () => { isLocked = true; updateBuzzerIndicator(); });
socket.on("round-reset", () => { isLocked = false; updateBuzzerIndicator(); });
socket.on("players-updated", (p) => { latestPlayers = p || {}; renderPlayersBar(); });

socket.on("player-buzzed-first", (payload) => {
  activePlayerId = payload?.playerId;
  activePlayerName = payload?.name || latestPlayers?.[activePlayerId]?.name;
  renderPlayersBar();
  safePlay(sfxBuzz);
  if (buzzInfoEl) { buzzInfoEl.textContent = `${activePlayerName} hat gebuzzert!`; buzzInfoEl.classList.remove("hidden"); }
  if (questionCardEl) questionCardEl.classList.add("question-card-buzzed");
});

// ===============================
// WebRTC Socket Events
// ===============================

// Board Socket-ID speichern
let boardSocketId = null;
let streamSentToBoard = false;
let connectionAttempts = 0;
const MAX_ATTEMPTS = 5;

// Funktion um Stream zum Board zu senden (mit Retry)
async function connectToBoard() {
  if (!boardSocketId) {
    console.log("⚠️ Keine Board-Socket-ID bekannt");
    return;
  }
  
  if (!localStream) {
    console.log("⚠️ Kein lokaler Stream");
    return;
  }
  
  if (!joined) {
    console.log("⚠️ Noch nicht gejoined");
    return;
  }
  
  if (streamSentToBoard && outgoingPC && outgoingPC.connectionState === "connected") {
    console.log("✅ Bereits verbunden mit Board");
    return;
  }
  
  connectionAttempts++;
  console.log(`🔄 Verbindungsversuch ${connectionAttempts}/${MAX_ATTEMPTS} zum Board...`);
  
  try {
    await sendOfferToBoard(boardSocketId);
  } catch (err) {
    console.error("❌ Verbindungsfehler:", err);
  }
}

// Board fragt nach unserem Stream
socket.on("webrtc-request-offer", ({ fromId }) => {
  console.log("📥 Board fragt nach meinem Stream:", fromId);
  boardSocketId = fromId; // Speichere Board-ID
  
  if (cameraReady && localStream) {
    console.log("📤 Sende Stream an Board...");
    sendOfferToBoard(fromId);
  } else {
    console.log("⏳ Kamera noch nicht bereit, warte...");
    // Warte bis Kamera bereit
    const waitForCam = setInterval(() => {
      if (cameraReady && localStream) {
        clearInterval(waitForCam);
        console.log("📤 Kamera jetzt bereit, sende Stream...");
        sendOfferToBoard(fromId);
      }
    }, 500);
    // Timeout nach 10s
    setTimeout(() => clearInterval(waitForCam), 10000);
  }
});

// Board Socket-ID empfangen
socket.on("board-socket-id", ({ socketId }) => {
  console.log("📍 Board Socket-ID erhalten:", socketId);
  boardSocketId = socketId;
  streamSentToBoard = false;
  connectionAttempts = 0;
  
  // Versuche sofort zu verbinden
  setTimeout(() => connectToBoard(), 500);
  
  // Retry nach 2s falls nicht verbunden
  setTimeout(() => {
    if (!streamSentToBoard || !outgoingPC || outgoingPC.connectionState !== "connected") {
      connectToBoard();
    }
  }, 2500);
  
  // Nochmal nach 5s
  setTimeout(() => {
    if (!streamSentToBoard || !outgoingPC || outgoingPC.connectionState !== "connected") {
      connectToBoard();
    }
  }, 5500);
});

// Host-Cam Offer empfangen
socket.on("webrtc-offer", ({ fromId, offer, streamType }) => {
  if (streamType === "host") {
    handleHostOffer(fromId, offer);
  }
});

// Answer auf unseren Offer
socket.on("webrtc-answer", ({ fromId, answer, streamType }) => {
  console.log("📥 Answer empfangen, streamType:", streamType, "fromId:", fromId);
  if (streamType === "player" && outgoingPC) {
    outgoingPC.setRemoteDescription(new RTCSessionDescription(answer))
      .then(() => console.log("✅ Remote Description gesetzt für Board-Verbindung"))
      .catch(err => console.error("❌ Remote Description Fehler:", err));
  } else if (streamType === "host" && hostPC) {
    hostPC.setRemoteDescription(new RTCSessionDescription(answer)).catch(console.error);
  }
});

// ICE Candidates
socket.on("webrtc-ice-candidate", ({ fromId, candidate, streamType }) => {
  handleIceCandidate(fromId, candidate, streamType);
});

// Host-Cam verfügbar
socket.on("host-cam-available", ({ socketId }) => {
  console.log("Host-Cam verfügbar:", socketId);
  // Host wird uns ein Offer senden
});

// ===============================
// Board Sync Events
// ===============================
socket.on("spectator-question-opened", (data) => {
  const { categoryIndex, questionIndex, question, value, type, imageUrl } = data;
  const cell = boardEl?.querySelector(`[data-category-index="${categoryIndex}"][data-question-index="${questionIndex}"]`);
  if (cell) cell.classList.add("board-cell-active");
  if (questionPointsInnerEl) { questionPointsInnerEl.textContent = `${value} Punkte`; questionPointsInnerEl.classList.remove("pop-in"); void questionPointsInnerEl.offsetWidth; questionPointsInnerEl.classList.add("pop-in"); }
  if (questionTextEl) questionTextEl.textContent = question || "";
  if (answerTextEl) { answerTextEl.textContent = ""; answerTextEl.classList.add("hidden"); }
  if (type === "image" && imageUrl && qImageEl && qMediaEl) { qImageEl.src = imageUrl; qMediaEl.classList.remove("hidden"); } else { if (qMediaEl) qMediaEl.classList.add("hidden"); }
  if (questionCardEl) questionCardEl.classList.toggle("is-estimate-question", type === "estimate");
  activePlayerId = null; activePlayerName = null;
  if (buzzInfoEl) { buzzInfoEl.textContent = ""; buzzInfoEl.classList.add("hidden"); }
  if (questionCardEl) questionCardEl.classList.remove("question-card-buzzed");
  if (estimateRevealContainer) estimateRevealContainer.classList.add("hidden");
  if (overlayEl) overlayEl.classList.remove("hidden");
});

socket.on("spectator-answer-shown", ({ answer }) => { if (answerTextEl) { answerTextEl.textContent = answer || ""; answerTextEl.classList.remove("hidden"); } closeLightbox(); });

socket.on("spectator-question-closed", ({ categoryIndex, questionIndex }) => {
  usedCells.add(`${categoryIndex}-${questionIndex}`);
  const cell = boardEl?.querySelector(`[data-category-index="${categoryIndex}"][data-question-index="${questionIndex}"]`);
  if (cell) { cell.classList.remove("board-cell-active"); cell.classList.add("board-cell-used"); }
  if (overlayEl) overlayEl.classList.add("hidden");
  activePlayerId = null; activePlayerName = null;
  if (buzzInfoEl) buzzInfoEl.classList.add("hidden");
  if (questionCardEl) questionCardEl.classList.remove("question-card-buzzed");
  closeLightbox();
  if (qMediaEl) qMediaEl.classList.add("hidden");
});

socket.on("spectator-correct", () => { safePlay(sfxCorrect); flashScreen("correct"); });
socket.on("spectator-wrong", () => { safePlay(sfxWrong); flashScreen("wrong"); });
socket.on("spectator-round-changed", ({ round }) => { currentRound = round; usedCells.clear(); buildBoard(); if (turnIndicatorEl) turnIndicatorEl.textContent = round >= 2 ? "Runde 2 (x2)" : "Warte auf Spieler…"; });
socket.on("spectator-turn-update", ({ playerName }) => { if (turnIndicatorEl && playerName) turnIndicatorEl.textContent = `⭐ ${playerName} ist dran ⭐`; });
socket.on("estimate-question-started", ({ question, timeLimit }) => { if (joined) openEstimateModal(question, timeLimit); });
socket.on("estimate-locked", () => { estimateLocked = true; if (estimateInput) estimateInput.disabled = true; if (sendEstimateBtn) sendEstimateBtn.disabled = true; });
socket.on("estimate-all-answered", closeEstimateModal);

socket.on("spectator-estimate-reveal", ({ answers }) => {
  if (!estimateRevealContainer || !estimateRevealList) return;
  estimateRevealList.innerHTML = "";
  if (answers?.length) {
    answers.forEach(a => {
      const row = document.createElement("div");
      row.className = "estimate-reveal-item visible";
      row.textContent = a.noAnswer ? `${a.name}: (keine Antwort)` : `${a.name}: ${a.value}`;
      if (a.isWinner) row.classList.add("estimate-winner-row");
      estimateRevealList.appendChild(row);
    });
  }
  estimateRevealContainer.classList.remove("hidden");
});

socket.on("game-ended", () => {
  joined = false; currentRoomCode = null; myPlayerId = null; buzzingEnabled = false; isLocked = false;
  if (outgoingPC) { try { outgoingPC.close(); } catch {} outgoingPC = null; }
  if (hostPC) { try { hostPC.close(); } catch {} hostPC = null; }
  if (joinOverlay) joinOverlay.classList.remove("hidden");
  if (mainPage) mainPage.classList.add("hidden");
  if (hostCamBox) hostCamBox.classList.add("hidden");
  updateBuzzerIndicator();
  closeEstimateModal();
  if (overlayEl) overlayEl.classList.add("hidden");
});

socket.on("disconnect", () => { buzzingEnabled = false; updateBuzzerIndicator(); closeEstimateModal(); });

// ===============================
// Init
// ===============================
(async () => {
  const { room, name } = loadJoin();
  if (room && roomCodeInput) roomCodeInput.value = room;
  if (name && nameInput) nameInput.value = name;
  buildBoard();
  renderPlayersBar();
  await initCamera();
})();
