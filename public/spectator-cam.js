// public/spectator-cam.js
// Spectator-Client mit WebRTC Kamera-Unterstützung für Streaming

const socket = io();

// ===============================
// WebRTC Configuration
// ===============================
const rtcConfig = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun2.l.google.com:19302' },
  ]
};

// ===============================
// DOM-Elemente
// ===============================

// Join UI
const joinOverlay = document.getElementById("spectatorJoinOverlay");
const roomCodeInput = document.getElementById("spectatorRoomCode");
const nameInput = document.getElementById("spectatorName");
const joinBtn = document.getElementById("spectatorJoinBtn");
const joinStatus = document.getElementById("spectatorJoinStatus");

// Camera Preview (vor Beitritt)
const camPreview = document.getElementById("camPreview");
const camPreviewStatus = document.getElementById("camPreviewStatus");

// Self Cam (im Spiel)
const selfCamWrap = document.getElementById("selfCamWrap");
const selfCam = document.getElementById("selfCam");

// Main Page
const mainPage = document.getElementById("spectatorMainPage");

// Buzzer Indicator (oben links wie Host)
const buzzerIndicator = document.getElementById("buzzerIndicator");
const buzzerText = document.getElementById("buzzerText");

// Board UI
const boardEl = document.getElementById("board");
const playersBarEl = document.getElementById("players-bar");
const turnIndicatorEl = document.getElementById("turnIndicator");

// Question Overlay
const overlayEl = document.getElementById("questionOverlay");
const questionCardEl = document.getElementById("questionCard");
const questionPointsEl = document.getElementById("questionPoints");
const questionPointsInnerEl = document.querySelector("#questionPoints .points-inner");
const questionTextEl = document.getElementById("questionText");
const answerTextEl = document.getElementById("answerText");
const buzzInfoEl = document.getElementById("buzzInfo");
const estimateBoardTimerEl = document.getElementById("estimateBoardTimer");

// Media
const qMediaEl = document.getElementById("qMedia");
const qImageEl = document.getElementById("qImage");
const lightboxEl = document.getElementById("lightbox");
const lightboxImgEl = document.getElementById("lightboxImg");
const lightboxCloseEl = document.getElementById("lightboxClose");

// Estimate Reveal (read-only)
const estimateRevealContainer = document.getElementById("estimateRevealContainer");
const estimateRevealList = document.getElementById("estimateRevealList");

// Estimate Input Modal
const estimateModal = document.getElementById("estimateModal");
const estimateQuestionTextEl = document.getElementById("estimateQuestionText");
const estimateInput = document.getElementById("estimateInput");
const estimateTimerEl = document.getElementById("estimateTimer");
const estimateStatusEl = document.getElementById("estimateStatus");
const sendEstimateBtn = document.getElementById("sendEstimateBtn");

// ===============================
// State
// ===============================
let currentRoomCode = null;
let currentName = null;
let myPlayerId = null;
let joined = false;
let buzzingEnabled = false;
let isLocked = false;

// Camera State
let localStream = null;
let cameraReady = false;

// WebRTC State
let peerConnections = {}; // { peerId: RTCPeerConnection }

// Schätzfrage State
let estimateActive = false;
let estimateLocked = false;
let estimateDeadline = null;
let estimateTimerInterval = null;

// Board State (vom Server synchronisiert)
let latestPlayers = {};
let activePlayerId = null;
let activePlayerName = null;
let currentRound = 1;
let usedCells = new Set();

// ===============================
// Sound-Effekte
// ===============================
const sfxTick = new Audio("/sounds/tick.wav");
sfxTick.volume = 0.25;

const sfxBuzz = new Audio("/sounds/buzzer-button.wav");
const sfxCorrect = new Audio("/sounds/correct-button.wav");
const sfxWrong = new Audio("/sounds/wrong-button.wav");

function safePlay(audio) {
  if (!audio) return;
  try {
    audio.currentTime = 0;
    audio.play().catch(() => {});
  } catch {}
}

function playTick() { safePlay(sfxTick); }
function playBuzzSound() { safePlay(sfxBuzz); }
function playCorrectSound() { safePlay(sfxCorrect); }
function playWrongSound() { safePlay(sfxWrong); }

// ===============================
// Screen Flash
// ===============================
function flashScreen(type) {
  const flashEl = document.getElementById("screenFlash");
  if (!flashEl) return;

  flashEl.classList.remove("screen-flash-green", "screen-flash-red", "screen-flash-active");

  requestAnimationFrame(() => {
    if (type === "correct") flashEl.classList.add("screen-flash-green");
    if (type === "wrong") flashEl.classList.add("screen-flash-red");

    requestAnimationFrame(() => {
      flashEl.classList.add("screen-flash-active");

      setTimeout(() => {
        flashEl.classList.remove("screen-flash-active", "screen-flash-green", "screen-flash-red");
      }, 350);
    });
  });
}

// ===============================
// LocalStorage Persistenz
// ===============================
const LS_ROOM = "jt_spectator_cam_roomCode";
const LS_NAME = "jt_spectator_cam_playerName";

function saveJoinToLocalStorage(roomCode, name) {
  try {
    localStorage.setItem(LS_ROOM, roomCode);
    localStorage.setItem(LS_NAME, name);
  } catch {}
}

function loadJoinFromLocalStorage() {
  try {
    const room = (localStorage.getItem(LS_ROOM) || "").trim().toUpperCase();
    const name = (localStorage.getItem(LS_NAME) || "").trim();
    return { room, name };
  } catch {
    return { room: "", name: "" };
  }
}

// ===============================
// Join Status
// ===============================
function setJoinStatus(msg, isError = false) {
  if (!joinStatus) return;
  joinStatus.textContent = msg || "";
  joinStatus.style.color = isError ? "#f97316" : "#2dd4bf";
}

// ===============================
// Camera Functions
// ===============================
async function initCamera() {
  try {
    if (camPreviewStatus) camPreviewStatus.textContent = "Kamera wird geladen...";

    localStream = await navigator.mediaDevices.getUserMedia({
      video: {
        width: { ideal: 320 },
        height: { ideal: 240 },
        facingMode: "user"
      },
      audio: false // Kein Audio, nur Video
    });

    // Preview anzeigen
    if (camPreview) {
      camPreview.srcObject = localStream;
      camPreview.classList.add("cam-preview-active");
    }

    if (camPreviewStatus) {
      camPreviewStatus.textContent = "✅ Kamera bereit!";
      camPreviewStatus.style.color = "#22c55e";
    }

    cameraReady = true;
    return true;

  } catch (err) {
    console.error("Camera error:", err);

    if (camPreviewStatus) {
      if (err.name === "NotAllowedError") {
        camPreviewStatus.textContent = "❌ Kamera-Zugriff verweigert";
      } else if (err.name === "NotFoundError") {
        camPreviewStatus.textContent = "❌ Keine Kamera gefunden";
      } else {
        camPreviewStatus.textContent = "❌ Kamera-Fehler: " + err.message;
      }
      camPreviewStatus.style.color = "#ef4444";
    }

    cameraReady = false;
    return false;
  }
}

function showSelfCam() {
  if (!selfCam || !localStream) return;

  selfCam.srcObject = localStream;
  if (selfCamWrap) selfCamWrap.classList.remove("hidden");
}

function stopCamera() {
  if (localStream) {
    localStream.getTracks().forEach(track => track.stop());
    localStream = null;
  }
  cameraReady = false;
}

// ===============================
// WebRTC Functions
// ===============================
function createPeerConnection(peerId) {
  if (peerConnections[peerId]) {
    peerConnections[peerId].close();
  }

  const pc = new RTCPeerConnection(rtcConfig);
  peerConnections[peerId] = pc;

  // Lokale Tracks hinzufügen
  if (localStream) {
    localStream.getTracks().forEach(track => {
      pc.addTrack(track, localStream);
    });
  }

  // ICE Candidates sammeln und senden
  pc.onicecandidate = (event) => {
    if (event.candidate) {
      socket.emit("webrtc-ice-candidate", {
        roomCode: currentRoomCode,
        targetId: peerId,
        candidate: event.candidate
      });
    }
  };

  pc.onconnectionstatechange = () => {
    console.log(`WebRTC connection to ${peerId}: ${pc.connectionState}`);
  };

  return pc;
}

async function sendOfferTo(peerId) {
  const pc = createPeerConnection(peerId);

  try {
    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);

    socket.emit("webrtc-offer", {
      roomCode: currentRoomCode,
      targetId: peerId,
      offer: pc.localDescription
    });

    console.log("Sent offer to:", peerId);
  } catch (err) {
    console.error("Error creating offer:", err);
  }
}

async function handleOffer(fromId, offer) {
  const pc = createPeerConnection(fromId);

  try {
    await pc.setRemoteDescription(new RTCSessionDescription(offer));
    const answer = await pc.createAnswer();
    await pc.setLocalDescription(answer);

    socket.emit("webrtc-answer", {
      roomCode: currentRoomCode,
      targetId: fromId,
      answer: pc.localDescription
    });

    console.log("Sent answer to:", fromId);
  } catch (err) {
    console.error("Error handling offer:", err);
  }
}

async function handleAnswer(fromId, answer) {
  const pc = peerConnections[fromId];
  if (!pc) return;

  try {
    await pc.setRemoteDescription(new RTCSessionDescription(answer));
    console.log("Set remote description from:", fromId);
  } catch (err) {
    console.error("Error handling answer:", err);
  }
}

async function handleIceCandidate(fromId, candidate) {
  const pc = peerConnections[fromId];
  if (!pc) return;

  try {
    await pc.addIceCandidate(new RTCIceCandidate(candidate));
  } catch (err) {
    console.error("Error adding ICE candidate:", err);
  }
}

// ===============================
// Buzzer Indicator UI
// ===============================
function updateBuzzerIndicator() {
  if (!buzzerIndicator || !buzzerText) return;

  if (!joined) {
    buzzerIndicator.classList.add("hidden");
    return;
  }

  buzzerIndicator.classList.remove("hidden");

  if (isLocked) {
    buzzerIndicator.classList.add("buzzer-locked");
    buzzerIndicator.classList.remove("buzzer-free");
    buzzerText.textContent = "GESPERRT";
    return;
  }

  if (buzzingEnabled) {
    buzzerIndicator.classList.remove("buzzer-locked");
    buzzerIndicator.classList.add("buzzer-free");
    buzzerText.textContent = "BUZZER FREI";
  } else {
    buzzerIndicator.classList.add("buzzer-locked");
    buzzerIndicator.classList.remove("buzzer-free");
    buzzerText.textContent = "BUZZER GESPERRT";
  }
}

// ===============================
// Kategorien (gleiche wie board.js)
// ===============================
const categoriesRound1 = [
  { name: "Geographie", questions: [{ value: 100 }, { value: 200 }, { value: 300 }, { value: 400 }, { value: 500 }] },
  { name: "Filme & Serien", questions: [{ value: 100 }, { value: 200 }, { value: 300 }, { value: 400 }, { value: 500 }] },
  { name: "Musik", questions: [{ value: 100 }, { value: 200 }, { value: 300 }, { value: 400 }, { value: 500 }] },
  { name: "Wer ist das?", questions: [{ value: 100 }, { value: 200 }, { value: 300 }, { value: 400 }, { value: 500 }] },
  { name: "Schätzfragen", questions: [{ value: 100 }, { value: 200 }, { value: 300 }, { value: 400 }, { value: 500 }] },
];

const categoriesRound2 = [
  { name: "Sport", questions: [{ value: 100 }, { value: 200 }, { value: 300 }, { value: 400 }, { value: 500 }] },
  { name: "Wissenschaft & Tech", questions: [{ value: 100 }, { value: 200 }, { value: 300 }, { value: 400 }, { value: 500 }] },
  { name: "Allgemeinwissen", questions: [{ value: 100 }, { value: 200 }, { value: 300 }, { value: 400 }, { value: 500 }] },
  { name: "Wer oder Was?", questions: [{ value: 100 }, { value: 200 }, { value: 300 }, { value: 400 }, { value: 500 }] },
  { name: "Schätzfragen", questions: [{ value: 100 }, { value: 200 }, { value: 300 }, { value: 400 }, { value: 500 }] },
];

function getCategories() {
  return currentRound >= 2 ? categoriesRound2 : categoriesRound1;
}

function getMultiplier() {
  return currentRound >= 2 ? 2 : 1;
}

// ===============================
// Board bauen (read-only)
// ===============================
function buildBoard() {
  if (!boardEl) return;
  boardEl.innerHTML = "";

  const categories = getCategories();
  const mult = getMultiplier();

  categories.forEach((cat, cIndex) => {
    const col = document.createElement("div");
    col.className = "board-column";

    const header = document.createElement("div");
    header.className = "board-category";
    header.textContent = cat.name;
    col.appendChild(header);

    cat.questions.forEach((q, qIndex) => {
      const cell = document.createElement("div");
      cell.className = "board-cell spectator-cell";

      const displayValue = (Number(q.value) || 0) * mult;
      cell.textContent = displayValue;

      cell.dataset.categoryIndex = String(cIndex);
      cell.dataset.questionIndex = String(qIndex);

      const usedKey = `${cIndex}-${qIndex}`;
      if (usedCells.has(usedKey)) {
        cell.classList.add("board-cell-used");
      }

      col.appendChild(cell);
    });

    boardEl.appendChild(col);
  });
}

// ===============================
// Spieler-Leiste MIT Video-Feeds
// ===============================
function renderPlayersBar() {
  if (!playersBarEl) return;

  const entries = Object.entries(latestPlayers || {});
  playersBarEl.innerHTML = "";

  if (entries.length === 0) {
    const empty = document.createElement("div");
    empty.className = "players-empty";
    empty.textContent = "Noch keine Spieler verbunden.";
    playersBarEl.appendChild(empty);
    return;
  }

  entries.forEach(([id, player]) => {
    const pill = document.createElement("div");
    pill.className = "player-pill player-pill-cam";

    // Video-Container für diesen Spieler
    const videoWrap = document.createElement("div");
    videoWrap.className = "player-video-wrap";
    videoWrap.id = `video-wrap-${id}`;

    // Placeholder wenn kein Video
    const videoPlaceholder = document.createElement("div");
    videoPlaceholder.className = "player-video-placeholder";
    videoPlaceholder.textContent = player.name?.charAt(0)?.toUpperCase() || "?";

    // Video-Element (wird später befüllt wenn Stream kommt)
    const videoEl = document.createElement("video");
    videoEl.className = "player-video hidden";
    videoEl.id = `video-${id}`;
    videoEl.autoplay = true;
    videoEl.muted = true;
    videoEl.playsInline = true;

    videoWrap.appendChild(videoPlaceholder);
    videoWrap.appendChild(videoEl);

    // Info-Bereich
    const infoDiv = document.createElement("div");
    infoDiv.className = "player-info";

    const nameSpan = document.createElement("span");
    nameSpan.className = "player-name";
    nameSpan.textContent = player.name || "(Unbekannt)";

    const scoreSpan = document.createElement("span");
    scoreSpan.className = "player-score";
    scoreSpan.textContent = `${player.score ?? 0} Pkt`;

    infoDiv.appendChild(nameSpan);
    infoDiv.appendChild(scoreSpan);

    pill.appendChild(videoWrap);
    pill.appendChild(infoDiv);

    if (id === activePlayerId) {
      pill.classList.add("player-pill-active");
    }

    playersBarEl.appendChild(pill);
  });
}

// ===============================
// Buzz Info
// ===============================
function updateBuzzInfo(isBuzzed) {
  if (!buzzInfoEl || !questionCardEl) return;

  if (isBuzzed && activePlayerName) {
    buzzInfoEl.textContent = `${activePlayerName} hat gebuzzert!`;
    buzzInfoEl.classList.remove("hidden");
    questionCardEl.classList.add("question-card-buzzed");
  } else {
    buzzInfoEl.textContent = "";
    buzzInfoEl.classList.add("hidden");
    questionCardEl.classList.remove("question-card-buzzed");
  }
}

// ===============================
// Lightbox
// ===============================
function openLightbox(src, alt) {
  if (!lightboxEl || !lightboxImgEl) return;
  lightboxImgEl.src = src;
  lightboxImgEl.alt = alt || "";
  lightboxEl.classList.remove("hidden");
}

function closeLightbox() {
  if (!lightboxEl || !lightboxImgEl) return;
  lightboxEl.classList.add("hidden");
  lightboxImgEl.src = "";
  lightboxImgEl.alt = "";
}

if (qImageEl) {
  qImageEl.addEventListener("click", () => {
    if (!qImageEl.src) return;
    openLightbox(qImageEl.src, qImageEl.alt || "");
  });
}

if (lightboxEl) {
  lightboxEl.addEventListener("click", (e) => {
    if (e.target === lightboxEl || e.target === lightboxImgEl) closeLightbox();
  });
}

if (lightboxCloseEl) {
  lightboxCloseEl.addEventListener("click", closeLightbox);
}

// ===============================
// Join Logic
// ===============================
function doJoin(roomCode, name, { silent = false } = {}) {
  const rc = (roomCode || "").trim().toUpperCase();
  const nm = (name || "").trim();

  if (!rc || !nm) {
    if (!silent) setJoinStatus("Bitte Raumcode und Namen eingeben.", true);
    return;
  }

  if (!cameraReady) {
    if (!silent) setJoinStatus("Kamera muss aktiv sein!", true);
    return;
  }

  // Mit Kamera-Flag beitreten
  socket.emit("player-join", { roomCode: rc, name: nm, hasCamera: true }, (res) => {
    if (!res || !res.success) {
      joined = false;
      currentRoomCode = null;
      currentName = null;
      myPlayerId = null;
      isLocked = false;
      updateBuzzerIndicator();
      if (!silent) setJoinStatus(res?.error || "Beitritt fehlgeschlagen.", true);
      return;
    }

    currentRoomCode = rc;
    currentName = nm;
    myPlayerId = res.playerId || socket.id;
    joined = true;

    saveJoinToLocalStorage(rc, nm);

    // Join Overlay ausblenden, Main Page einblenden
    if (joinOverlay) joinOverlay.classList.add("hidden");
    if (mainPage) mainPage.classList.remove("hidden");

    // Self-Cam anzeigen
    showSelfCam();

    updateBuzzerIndicator();
    if (!silent) setJoinStatus("Erfolgreich beigetreten!");

    // Als Spectator für Board-Updates registrieren
    socket.emit("spectator-join-room", { roomCode: rc, hasCamera: true });

    // Board mitteilen dass wir Kamera haben
    socket.emit("cam-player-ready", { roomCode: rc, playerId: myPlayerId });
  });
}

// Join Button
if (joinBtn) {
  joinBtn.addEventListener("click", () => {
    const roomCode = (roomCodeInput.value || "").trim().toUpperCase();
    const name = (nameInput.value || "").trim();
    doJoin(roomCode, name);
  });
}

// Enter-Taste in Inputs
[roomCodeInput, nameInput].forEach((input) => {
  if (input) {
    input.addEventListener("keydown", (e) => {
      if (e.key === "Enter") joinBtn.click();
    });
  }
});

// ===============================
// Buzzer Logic (Keyboard SPACE)
// ===============================
document.addEventListener("keydown", (e) => {
  if (e.code !== "Space") return;

  const t = e.target;
  const isTyping = t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable);
  if (isTyping) return;

  if (!joined || !currentRoomCode || !buzzingEnabled || isLocked) return;

  e.preventDefault();

  // Visual feedback
  if (buzzerIndicator) {
    buzzerIndicator.classList.add("buzzer-pressed");
    setTimeout(() => buzzerIndicator.classList.remove("buzzer-pressed"), 150);
  }

  socket.emit("player-buzz", { roomCode: currentRoomCode });

  buzzingEnabled = false;
  updateBuzzerIndicator();
});

// ===============================
// Schätzfrage UI (gleich wie spectator.js)
// ===============================
let lastTickSecond = null;

function openEstimateModal(questionText, timeLimitSec) {
  estimateActive = true;
  estimateLocked = false;

  if (estimateQuestionTextEl) estimateQuestionTextEl.textContent = questionText || "";
  if (estimateInput) {
    estimateInput.value = "";
    estimateInput.disabled = false;
  }
  if (sendEstimateBtn) sendEstimateBtn.disabled = false;
  if (estimateStatusEl) estimateStatusEl.textContent = "";

  const now = Date.now();
  const limit = typeof timeLimitSec === "number" && timeLimitSec > 0 ? timeLimitSec : 30;
  estimateDeadline = now + limit * 1000;

  lastTickSecond = null;

  if (estimateTimerEl) estimateTimerEl.classList.remove("is-warning", "is-danger");

  updateEstimateTimer();

  if (estimateTimerInterval) clearInterval(estimateTimerInterval);
  estimateTimerInterval = setInterval(updateEstimateTimer, 200);

  if (estimateModal) {
    estimateModal.classList.remove("hidden", "estimate-slide-out");
    estimateModal.classList.add("estimate-slide-in");
  }
}

function closeEstimateModal() {
  estimateActive = false;

  if (estimateTimerInterval) clearInterval(estimateTimerInterval);
  estimateTimerInterval = null;
  estimateDeadline = null;

  if (estimateTimerEl) estimateTimerEl.classList.remove("is-warning", "is-danger");

  if (estimateModal && !estimateModal.classList.contains("hidden")) {
    estimateModal.classList.remove("estimate-slide-in");
    estimateModal.classList.add("estimate-slide-out");

    setTimeout(() => {
      estimateModal.classList.add("hidden");
      estimateModal.classList.remove("estimate-slide-out");
    }, 250);
  }
}

function updateEstimateTimer() {
  if (!estimateDeadline || !estimateTimerEl) return;

  const diffMs = estimateDeadline - Date.now();
  const diffSec = Math.max(0, Math.ceil(diffMs / 1000));

  estimateTimerEl.classList.remove("is-warning", "is-danger");

  if (diffSec <= 5 && diffSec > 3) estimateTimerEl.classList.add("is-warning");
  if (diffSec <= 3 && diffSec > 0) estimateTimerEl.classList.add("is-danger");

  if (diffSec <= 3 && diffSec > 0 && lastTickSecond !== diffSec) {
    lastTickSecond = diffSec;
    playTick();
  }

  if (diffSec > 0) {
    estimateTimerEl.textContent = diffSec + "s";
    return;
  }

  estimateTimerEl.textContent = "0s";

  if (estimateTimerInterval) clearInterval(estimateTimerInterval);
  estimateTimerInterval = null;

  if (!estimateLocked) {
    estimateLocked = true;
    if (estimateInput) estimateInput.disabled = true;
    if (sendEstimateBtn) sendEstimateBtn.disabled = true;
    if (estimateStatusEl && !estimateStatusEl.textContent) {
      estimateStatusEl.textContent = "Zeit abgelaufen.";
    }
    sendEstimateToServer({ value: null, noAnswer: true });
  }

  setTimeout(() => closeEstimateModal(), 600);
}

function sendEstimateToServer({ value, noAnswer }) {
  if (!joined || !currentRoomCode) return;

  socket.emit("estimate-answer", {
    roomCode: currentRoomCode,
    value,
    noAnswer: !!noAnswer,
  });
}

if (sendEstimateBtn) {
  sendEstimateBtn.addEventListener("click", () => {
    if (!estimateActive || estimateLocked) return;

    const raw = (estimateInput.value || "").trim();

    let value = null;
    if (raw !== "") {
      const normalized = raw.replace(/'/g, "").replace(/,/g, ".");
      value = Number(normalized);
      if (!Number.isFinite(value)) {
        if (estimateStatusEl) estimateStatusEl.textContent = "Bitte eine gültige Zahl eingeben.";
        return;
      }
    }

    if (value === null) {
      sendEstimateToServer({ value: null, noAnswer: true });
    } else {
      sendEstimateToServer({ value, noAnswer: false });
    }

    estimateLocked = true;
    if (estimateInput) estimateInput.disabled = true;
    if (sendEstimateBtn) sendEstimateBtn.disabled = true;
    if (estimateStatusEl) estimateStatusEl.textContent = "✅ Antwort gespeichert.";
  });
}

if (estimateInput) {
  estimateInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && sendEstimateBtn) sendEstimateBtn.click();
  });
}

// ===============================
// Socket Events - Player/Buzzer
// ===============================
socket.on("buzzing-status", ({ enabled }) => {
  buzzingEnabled = !!enabled;
  updateBuzzerIndicator();
});

socket.on("you-are-locked", () => {
  isLocked = true;
  updateBuzzerIndicator();
});

socket.on("round-reset", () => {
  isLocked = false;
  updateBuzzerIndicator();
});

socket.on("players-updated", (serverPlayers) => {
  latestPlayers = serverPlayers || {};
  renderPlayersBar();
});

socket.on("player-buzzed-first", (payload) => {
  const id = payload?.playerId || payload?.socketId;
  const name = payload?.name;

  if (!id) return;

  activePlayerId = id;
  activePlayerName = name || (latestPlayers?.[id]?.name ?? null);

  renderPlayersBar();
  playBuzzSound();
  updateBuzzInfo(true);

  document.body.classList.add("is-buzz-locked");
});

// ===============================
// Socket Events - WebRTC Signaling
// ===============================
socket.on("webrtc-request-offer", ({ fromId }) => {
  // Board oder anderer Peer fragt nach unserem Stream
  console.log("Offer requested from:", fromId);
  if (cameraReady && localStream) {
    sendOfferTo(fromId);
  }
});

socket.on("webrtc-offer", ({ fromId, offer }) => {
  console.log("Received offer from:", fromId);
  handleOffer(fromId, offer);
});

socket.on("webrtc-answer", ({ fromId, answer }) => {
  console.log("Received answer from:", fromId);
  handleAnswer(fromId, answer);
});

socket.on("webrtc-ice-candidate", ({ fromId, candidate }) => {
  handleIceCandidate(fromId, candidate);
});

// ===============================
// Socket Events - Board Sync (vom Host)
// ===============================
socket.on("spectator-question-opened", (data) => {
  const { categoryIndex, questionIndex, question, value, type, imageUrl, timeLimit } = data;

  const cell = boardEl?.querySelector(`[data-category-index="${categoryIndex}"][data-question-index="${questionIndex}"]`);
  if (cell) {
    cell.classList.add("board-cell-active");
  }

  if (questionPointsInnerEl) {
    questionPointsInnerEl.textContent = `${value} Punkte`;
    questionPointsInnerEl.classList.remove("pop-in");
    void questionPointsInnerEl.offsetWidth;
    questionPointsInnerEl.classList.add("pop-in");
  }

  if (questionTextEl) questionTextEl.textContent = question || "";
  if (answerTextEl) {
    answerTextEl.textContent = "";
    answerTextEl.classList.add("hidden");
  }

  if (type === "image" && imageUrl && qImageEl && qMediaEl) {
    qImageEl.src = imageUrl;
    qMediaEl.classList.remove("hidden");
  } else {
    if (qMediaEl) qMediaEl.classList.add("hidden");
    if (qImageEl) qImageEl.src = "";
  }

  if (questionCardEl) {
    if (type === "estimate") {
      questionCardEl.classList.add("is-estimate-question");
    } else {
      questionCardEl.classList.remove("is-estimate-question");
    }
  }

  activePlayerId = null;
  activePlayerName = null;
  updateBuzzInfo(false);
  document.body.classList.remove("is-buzz-locked");

  if (estimateRevealContainer) estimateRevealContainer.classList.add("hidden");
  if (estimateRevealList) estimateRevealList.innerHTML = "";

  if (overlayEl) overlayEl.classList.remove("hidden");
});

socket.on("spectator-answer-shown", (data) => {
  const { answer } = data;

  if (answerTextEl) {
    answerTextEl.textContent = answer || "";
    answerTextEl.classList.remove("hidden");
  }

  document.body.classList.remove("is-buzz-locked");
  closeLightbox();
});

socket.on("spectator-question-closed", (data) => {
  const { categoryIndex, questionIndex } = data;

  const usedKey = `${categoryIndex}-${questionIndex}`;
  usedCells.add(usedKey);

  const cell = boardEl?.querySelector(`[data-category-index="${categoryIndex}"][data-question-index="${questionIndex}"]`);
  if (cell) {
    cell.classList.remove("board-cell-active");
    cell.classList.add("board-cell-used");
  }

  if (overlayEl) overlayEl.classList.add("hidden");

  activePlayerId = null;
  activePlayerName = null;
  updateBuzzInfo(false);
  document.body.classList.remove("is-buzz-locked");
  closeLightbox();

  if (qMediaEl) qMediaEl.classList.add("hidden");
  if (qImageEl) qImageEl.src = "";
});

socket.on("spectator-correct", () => {
  playCorrectSound();
  flashScreen("correct");
});

socket.on("spectator-wrong", () => {
  playWrongSound();
  flashScreen("wrong");
});

socket.on("spectator-round-changed", ({ round }) => {
  currentRound = round;
  usedCells.clear();
  buildBoard();

  if (turnIndicatorEl) {
    turnIndicatorEl.textContent = round >= 2 ? "Runde 2 (x2) – Warte auf Spieler…" : "Warte auf Spieler…";
  }
});

socket.on("spectator-turn-update", ({ playerName }) => {
  if (turnIndicatorEl && playerName) {
    turnIndicatorEl.textContent = `⭐ ${playerName} ist dran ⭐`;
  }
});

// Schätzfragen Events
socket.on("estimate-question-started", ({ question, timeLimit }) => {
  if (!joined) return;
  openEstimateModal(question, timeLimit || 30);
});

socket.on("estimate-locked", () => {
  estimateLocked = true;
  if (estimateInput) estimateInput.disabled = true;
  if (sendEstimateBtn) sendEstimateBtn.disabled = true;
  if (estimateStatusEl && !estimateStatusEl.textContent) {
    estimateStatusEl.textContent = "⏱ Zeit abgelaufen.";
  }
});

socket.on("estimate-all-answered", () => {
  closeEstimateModal();
});

socket.on("spectator-estimate-reveal", ({ answers }) => {
  if (!estimateRevealContainer || !estimateRevealList) return;

  estimateRevealList.innerHTML = "";

  if (answers && Array.isArray(answers)) {
    answers.forEach((ans) => {
      const row = document.createElement("div");
      row.className = "estimate-reveal-item visible";

      if (ans.noAnswer) {
        row.textContent = `${ans.name}: (keine Antwort)`;
      } else {
        row.textContent = `${ans.name}: ${ans.value}`;
      }

      if (ans.isWinner) {
        row.classList.add("estimate-winner-row");
      }

      estimateRevealList.appendChild(row);
    });
  }

  estimateRevealContainer.classList.remove("hidden");
});

socket.on("game-ended", () => {
  joined = false;
  currentRoomCode = null;
  currentName = null;
  myPlayerId = null;
  buzzingEnabled = false;
  isLocked = false;

  // WebRTC aufräumen
  Object.values(peerConnections).forEach(pc => pc.close());
  peerConnections = {};

  if (joinOverlay) joinOverlay.classList.remove("hidden");
  if (mainPage) mainPage.classList.add("hidden");
  if (selfCamWrap) selfCamWrap.classList.add("hidden");

  updateBuzzerIndicator();
  setJoinStatus("Spiel beendet. Du kannst einem neuen Raum beitreten.");
  closeEstimateModal();

  if (overlayEl) overlayEl.classList.add("hidden");
});

socket.on("disconnect", () => {
  buzzingEnabled = false;
  updateBuzzerIndicator();
  closeEstimateModal();
});

// Reconnect
socket.on("connect", () => {
  const { room, name } = loadJoinFromLocalStorage();

  if (roomCodeInput && room) roomCodeInput.value = room;
  if (nameInput && name) nameInput.value = name;
});

// ===============================
// Init
// ===============================
(async () => {
  const { room, name } = loadJoinFromLocalStorage();
  if (room && roomCodeInput) roomCodeInput.value = room;
  if (name && nameInput) nameInput.value = name;

  buildBoard();
  renderPlayersBar();

  if (turnIndicatorEl) {
    turnIndicatorEl.textContent = "Warte auf Spieler…";
  }

  // Decimal Input Setup
  if (estimateInput) {
    estimateInput.setAttribute("type", "text");
    estimateInput.setAttribute("inputmode", "decimal");
    estimateInput.setAttribute("pattern", "[0-9.,]*");
    estimateInput.setAttribute("placeholder", "z.B. 13,8 oder 1500");
  }

  // Kamera initialisieren
  await initCamera();
})();
