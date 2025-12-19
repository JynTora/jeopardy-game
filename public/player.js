// public/player.js
// Player-Client für Jyn Tora Jeopardy

const socket = io();

const roomCodeInput = document.getElementById("roomCodeInput");
const playerNameInput = document.getElementById("playerNameInput");
const joinBtn = document.getElementById("joinBtn");
const joinStatusEl = document.getElementById("joinStatus");

const buzzBtn = document.getElementById("buzzBtn");
const buzzStatusEl = document.getElementById("buzzStatus");

// Schätzfrage-UI
const estimateModal = document.getElementById("estimateModal");
const estimateQuestionTextEl = document.getElementById("estimateQuestionText");
const estimateInput = document.getElementById("estimateInput");
const estimateTimerEl = document.getElementById("estimateTimer");
const estimateStatusEl = document.getElementById("estimateStatus");
const sendEstimateBtn = document.getElementById("sendEstimateBtn");

let currentRoomCode = null;
let currentName = null;
let joined = false;
let buzzingEnabled = false;

// ✅ Lock-State (pro Frage)
let isLocked = false;

// Schätzfrage-State
let estimateActive = false;
let estimateLocked = false;
let estimateDeadline = null;
let estimateTimerInterval = null;

// ===============================
// Optional: Tick-Sound (3-2-1)
// ===============================
const sfxTick = new Audio("/sounds/tick.wav");
sfxTick.volume = 0.25;

function playTick() {
  try {
    sfxTick.currentTime = 0;
    sfxTick.play().catch(() => {});
  } catch {}
}

let lastTickSecond = null;

function setJoinStatus(msg, isError = false) {
  if (!joinStatusEl) return;
  joinStatusEl.textContent = msg || "";
  joinStatusEl.style.color = isError ? "#f97316" : "#a5b4fc";
}

function updateBuzzUI() {
  if (!joined) {
    buzzBtn.disabled = true;
    buzzStatusEl.textContent = "Bitte zuerst beitreten.";
    return;
  }

  if (isLocked) {
    buzzBtn.disabled = true;
    buzzStatusEl.textContent = "❌ Du bist für diese Frage gesperrt";
    return;
  }

  if (buzzingEnabled) {
    buzzBtn.disabled = false;
    buzzStatusEl.textContent = "🟢 Buzzer aktiv – drück BUZZ!";
  } else {
    buzzBtn.disabled = true;
    buzzStatusEl.textContent = "🦆 Buzzer gesperrt";
  }
}

// ---------------------------
// Persistenz (Room + Name)
// ---------------------------
const LS_ROOM = "jt_roomCode";
const LS_NAME = "jt_playerName";

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

function lockJoinInputs() {
  roomCodeInput.disabled = true;
  playerNameInput.disabled = true;
  joinBtn.disabled = true;
}

function unlockJoinInputs() {
  roomCodeInput.disabled = false;
  playerNameInput.disabled = false;
  joinBtn.disabled = false;
}

// ---------------------------
// Join (einmalig + Rejoin bei Reconnect)
// ---------------------------
function doJoin(roomCode, name, { silent = false } = {}) {
  const rc = (roomCode || "").trim().toUpperCase();
  const nm = (name || "").trim();

  if (!rc || !nm) {
    if (!silent) setJoinStatus("Bitte Raumcode und Namen eingeben.", true);
    return;
  }

  socket.emit("player-join", { roomCode: rc, name: nm }, (res) => {
    if (!res || !res.success) {
      joined = false;
      currentRoomCode = null;
      currentName = null;
      isLocked = false;
      unlockJoinInputs();
      updateBuzzUI();
      if (!silent)
        setJoinStatus(res?.error || "Beitritt fehlgeschlagen.", true);
      return;
    }

    currentRoomCode = rc;
    currentName = nm;
    joined = true;

    saveJoinToLocalStorage(rc, nm);
    lockJoinInputs();
    updateBuzzUI();

    if (!silent) setJoinStatus("Erfolgreich beigetreten.");
  });
}

joinBtn.addEventListener("click", () => {
  const roomCode = (roomCodeInput.value || "").trim().toUpperCase();
  const name = (playerNameInput.value || "").trim();
  doJoin(roomCode, name);
});

[roomCodeInput, playerNameInput].forEach((input) => {
  input.addEventListener("keydown", (e) => {
    if (e.key === "Enter") joinBtn.click();
  });
});

// ---------------------------
// Buzzer
// ---------------------------
buzzBtn.addEventListener("click", () => {
  if (!joined || !currentRoomCode || !buzzingEnabled || isLocked) return;

  socket.emit("player-buzz", { roomCode: currentRoomCode });

  buzzingEnabled = false;
  updateBuzzUI();
});

// ---------------------------
// Schätzfrage UI
// ---------------------------
function openEstimateModal(questionText, timeLimitSec) {
  estimateActive = true;
  estimateLocked = false;

  estimateQuestionTextEl.textContent = questionText || "";
  estimateInput.value = "";
  estimateInput.disabled = false;
  sendEstimateBtn.disabled = false;
  estimateStatusEl.textContent = "";

  const now = Date.now();
  const limit =
    typeof timeLimitSec === "number" && timeLimitSec > 0 ? timeLimitSec : 30;
  estimateDeadline = now + limit * 1000;

  lastTickSecond = null;

  if (estimateTimerEl)
    estimateTimerEl.classList.remove("is-warning", "is-danger");

  updateEstimateTimer();

  if (estimateTimerInterval) clearInterval(estimateTimerInterval);
  estimateTimerInterval = setInterval(updateEstimateTimer, 200);

  estimateModal.classList.remove("hidden", "estimate-slide-out");
  estimateModal.classList.add("estimate-slide-in");
}

function closeEstimateModal() {
  estimateActive = false;

  if (estimateTimerInterval) clearInterval(estimateTimerInterval);
  estimateTimerInterval = null;
  estimateDeadline = null;

  if (estimateTimerEl)
    estimateTimerEl.classList.remove("is-warning", "is-danger");

  if (!estimateModal.classList.contains("hidden")) {
    estimateModal.classList.remove("estimate-slide-in");
    estimateModal.classList.add("estimate-slide-out");

    setTimeout(() => {
      estimateModal.classList.add("hidden");
      estimateModal.classList.remove("estimate-slide-out");
    }, 250);
  }
}

function sendEstimateToServer({ value, noAnswer }) {
  if (!joined || !currentRoomCode) return;

  socket.emit("estimate-answer", {
    roomCode: currentRoomCode,
    value,
    noAnswer: !!noAnswer,
  });
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
    estimateInput.disabled = true;
    sendEstimateBtn.disabled = true;
    if (!estimateStatusEl.textContent)
      estimateStatusEl.textContent = "Zeit abgelaufen.";
    sendEstimateToServer({ value: null, noAnswer: true });
  }

  setTimeout(() => closeEstimateModal(), 600);
}

// ---------------------------
// Schätzfrage – Antwort senden
// ---------------------------
sendEstimateBtn.addEventListener("click", () => {
  if (!estimateActive || estimateLocked) return;

  const raw = (estimateInput.value || "").trim();

  let value = null;
  if (raw !== "") {
    const normalized = raw.replace(/'/g, "");
    value = Number(normalized);
    if (!Number.isFinite(value)) {
      estimateStatusEl.textContent = "Bitte eine gültige Zahl eingeben.";
      return;
    }
  }

  if (value === null) {
    sendEstimateToServer({ value: null, noAnswer: true });
  } else {
    sendEstimateToServer({ value, noAnswer: false });
  }

  estimateLocked = true;
  estimateInput.disabled = true;
  sendEstimateBtn.disabled = true;
  estimateStatusEl.textContent = "✅ Antwort gespeichert.";
});

estimateInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter") sendEstimateBtn.click();
});

// ---------------------------
// Socket-Events
// ---------------------------
socket.on("buzzing-status", ({ enabled }) => {
  buzzingEnabled = !!enabled;
  updateBuzzUI();
});

socket.on("you-are-locked", () => {
  isLocked = true;
  updateBuzzUI();
});

socket.on("round-reset", () => {
  isLocked = false;
  updateBuzzUI();
});

socket.on("estimate-question-started", ({ question, timeLimit }) => {
  if (!joined) return;
  openEstimateModal(question, timeLimit || 30);
});

socket.on("estimate-locked", () => {
  estimateLocked = true;
  estimateInput.disabled = true;
  sendEstimateBtn.disabled = true;
  if (!estimateStatusEl.textContent)
    estimateStatusEl.textContent = "⏱ Zeit abgelaufen.";
});

socket.on("estimate-all-answered", () => {
  closeEstimateModal();
});

socket.on("game-ended", () => {
  joined = false;
  currentRoomCode = null;
  currentName = null;
  buzzingEnabled = false;
  isLocked = false;

  unlockJoinInputs();
  buzzBtn.disabled = true;
  setJoinStatus("Spiel beendet. Du kannst einem neuen Raum beitreten.");
  buzzStatusEl.textContent = "🦆 Buzzer gesperrt";
  closeEstimateModal();
});

socket.on("disconnect", () => {
  buzzingEnabled = false;
  buzzBtn.disabled = true;
  buzzStatusEl.textContent = "Verbindung getrennt.";
  closeEstimateModal();
});

// WICHTIG: bei Reconnect automatisch wieder joinen (mit gespeichertem Name+Room)
socket.on("connect", () => {
  const { room, name } = loadJoinFromLocalStorage();

  // Inputs befüllen (nur UX)
  if (room && roomCodeInput) roomCodeInput.value = room;
  if (name && playerNameInput) playerNameInput.value = name;

  if (room && name) {
    doJoin(room, name, { silent: true });
  }
});

// ===============================
// Keyboard-Buzzer (SPACE)
// ===============================
document.addEventListener("keydown", (e) => {
  if (e.code !== "Space") return;

  const t = e.target;
  const isTyping =
    t &&
    (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable);
  if (isTyping) return;

  if (!buzzBtn || buzzBtn.disabled) return;

  buzzBtn.classList.add("player-buzzer-pulse");
  setTimeout(() => buzzBtn.classList.remove("player-buzzer-pulse"), 180);

  e.preventDefault();
  buzzBtn.click();
});

// ---------------------------
// Init: ggf. Autofill aus localStorage
// ---------------------------
(() => {
  const { room, name } = loadJoinFromLocalStorage();
  if (room && roomCodeInput) roomCodeInput.value = room;
  if (name && playerNameInput) playerNameInput.value = name;
})();
