// public/spectator.js
// Spectator-Client für Online-Modus (sieht Board, kann buzzern, aber nicht steuern)

const socket = io();

// ===============================
// DOM-Elemente
// ===============================

// Join UI
const joinOverlay = document.getElementById("spectatorJoinOverlay");
const roomCodeInput = document.getElementById("spectatorRoomCode");
const nameInput = document.getElementById("spectatorName");
const joinBtn = document.getElementById("spectatorJoinBtn");
const joinStatus = document.getElementById("spectatorJoinStatus");

// Main Page
const spectatorPage = document.getElementById("spectatorPage");

// Buzzer UI
const buzzerWrap = document.getElementById("spectatorBuzzerWrap");
const buzzBtn = document.getElementById("spectatorBuzzBtn");
const buzzStatus = document.getElementById("spectatorBuzzStatus");

// Board UI
const boardEl = document.getElementById("board");
const playersBarEl = document.getElementById("players-bar");
const turnIndicatorEl = document.getElementById("turnIndicator");

// Question Overlay
const overlayEl = document.getElementById("questionOverlay");
const questionCardEl = document.getElementById("questionCard");
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

// Estimate Reveal
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
let joined = false;
let buzzingEnabled = false;
let isLocked = false;

// Schätzfrage State
let estimateActive = false;
let estimateLocked = false;
let estimateDeadline = null;
let estimateTimerInterval = null;

// Board State
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
  try { audio.currentTime = 0; audio.play().catch(() => {}); } catch {}
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
  if (type === "correct") flashEl.classList.add("screen-flash-green");
  if (type === "wrong") flashEl.classList.add("screen-flash-red");
  requestAnimationFrame(() => flashEl.classList.add("screen-flash-active"));
  setTimeout(() => flashEl.classList.remove("screen-flash-active"), 350);
}

// ===============================
// LocalStorage Persistenz
// ===============================
const LS_ROOM = "jt_spectator_roomCode";
const LS_NAME = "jt_spectator_playerName";

function saveJoinToLocalStorage(roomCode, name) {
  try {
    localStorage.setItem(LS_ROOM, roomCode);
    localStorage.setItem(LS_NAME, name);
  } catch {}
}

function loadJoinFromLocalStorage() {
  try {
    return {
      room: (localStorage.getItem(LS_ROOM) || "").trim().toUpperCase(),
      name: (localStorage.getItem(LS_NAME) || "").trim(),
    };
  } catch { return { room: "", name: "" }; }
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
// Buzzer UI
// ===============================
function updateBuzzUI() {
  if (!joined) {
    buzzBtn.disabled = true;
    buzzStatus.textContent = "Bitte zuerst beitreten.";
    return;
  }
  if (isLocked) {
    buzzBtn.disabled = true;
    buzzStatus.textContent = "❌ Du bist für diese Frage gesperrt";
    return;
  }
  if (buzzingEnabled) {
    buzzBtn.disabled = false;
    buzzStatus.textContent = "🟢 Buzzer aktiv – drück BUZZ!";
  } else {
    buzzBtn.disabled = true;
    buzzStatus.textContent = "🦆 Buzzer gesperrt";
  }
}

// ===============================
// Kategorien (identisch zu board.js)
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

function getCategories() { return currentRound >= 2 ? categoriesRound2 : categoriesRound1; }
function getMultiplier() { return currentRound >= 2 ? 2 : 1; }

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
// Spieler-Leiste
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
    pill.className = "player-pill";

    const statusDot = document.createElement("span");
    statusDot.className = "player-status-dot";
    statusDot.textContent = player.connected === false ? "🔴" : "🟢";

    const nameSpan = document.createElement("span");
    nameSpan.className = "player-name";
    nameSpan.textContent = `${player.name}:`;

    const scoreSpan = document.createElement("span");
    scoreSpan.className = "player-score";
    scoreSpan.textContent = ` ${player.score} Punkte`;

    pill.appendChild(statusDot);
    pill.appendChild(nameSpan);
    pill.appendChild(scoreSpan);

    if (id === activePlayerId) pill.classList.add("player-pill-active");

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

  // Als Spieler joinen
  socket.emit("player-join", { roomCode: rc, name: nm }, (res) => {
    if (!res || !res.success) {
      joined = false;
      currentRoomCode = null;
      currentName = null;
      isLocked = false;
      updateBuzzUI();
      if (!silent) setJoinStatus(res?.error || "Beitritt fehlgeschlagen.", true);
      return;
    }

    currentRoomCode = rc;
    currentName = nm;
    joined = true;

    saveJoinToLocalStorage(rc, nm);

    // UI wechseln: Join Overlay weg, Board + Buzzer sichtbar
    if (joinOverlay) joinOverlay.classList.add("hidden");
    if (spectatorPage) spectatorPage.classList.remove("hidden");
    if (buzzerWrap) buzzerWrap.classList.remove("hidden");

    updateBuzzUI();
    if (!silent) setJoinStatus("Erfolgreich beigetreten!");

    // Als Spectator für Board-Updates registrieren
    socket.emit("spectator-join-room", { roomCode: rc });
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

// Enter-Taste
[roomCodeInput, nameInput].forEach((input) => {
  if (input) {
    input.addEventListener("keydown", (e) => {
      if (e.key === "Enter") joinBtn.click();
    });
  }
});

// ===============================
// Buzzer Logic
// ===============================
if (buzzBtn) {
  buzzBtn.addEventListener("click", () => {
    if (!joined || !currentRoomCode || !buzzingEnabled || isLocked) return;
    socket.emit("player-buzz", { roomCode: currentRoomCode });
    buzzingEnabled = false;
    updateBuzzUI();
  });
}

// Keyboard Buzzer (SPACE)
document.addEventListener("keydown", (e) => {
  if (e.code !== "Space") return;
  const t = e.target;
  const isTyping = t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable);
  if (isTyping) return;
  if (!buzzBtn || buzzBtn.disabled) return;

  buzzBtn.classList.add("spectator-buzz-pulse");
  setTimeout(() => buzzBtn.classList.remove("spectator-buzz-pulse"), 180);

  e.preventDefault();
  buzzBtn.click();
});

// ===============================
// Schätzfrage UI
// ===============================
let lastTickSecond = null;

function openEstimateModal(questionText, timeLimitSec) {
  estimateActive = true;
  estimateLocked = false;

  if (estimateQuestionTextEl) estimateQuestionTextEl.textContent = questionText || "";
  if (estimateInput) { estimateInput.value = ""; estimateInput.disabled = false; }
  if (sendEstimateBtn) sendEstimateBtn.disabled = false;
  if (estimateStatusEl) estimateStatusEl.textContent = "";

  const limit = typeof timeLimitSec === "number" && timeLimitSec > 0 ? timeLimitSec : 30;
  estimateDeadline = Date.now() + limit * 1000;
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
// Socket Events - Board Sync
// ===============================
socket.on("spectator-question-opened", (data) => {
  const { categoryIndex, questionIndex, question, value, type, imageUrl } = data;

  // Zelle markieren
  const cell = boardEl?.querySelector(`[data-category-index="${categoryIndex}"][data-question-index="${questionIndex}"]`);
  if (cell) cell.classList.add("board-cell-active");

  // Overlay öffnen
  if (questionPointsInnerEl) {
    questionPointsInnerEl.textContent = `${value} Punkte`;
    questionPointsInnerEl.classList.remove("pop-in");
    void questionPointsInnerEl.offsetWidth;
    questionPointsInnerEl.classList.add("pop-in");
  }

  if (questionTextEl) questionTextEl.textContent = question || "";
  if (answerTextEl) { answerTextEl.textContent = ""; answerTextEl.classList.add("hidden"); }

  // Bild
  if (type === "image" && imageUrl && qImageEl && qMediaEl) {
    qImageEl.src = imageUrl;
    qMediaEl.classList.remove("hidden");
  } else {
    if (qMediaEl) qMediaEl.classList.add("hidden");
    if (qImageEl) qImageEl.src = "";
  }

  // Estimate-Klasse
  if (questionCardEl) {
    questionCardEl.classList.toggle("is-estimate-question", type === "estimate");
  }

  // Reset states
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

  // Zelle als benutzt markieren
  const usedKey = `${categoryIndex}-${questionIndex}`;
  usedCells.add(usedKey);

  const cell = boardEl?.querySelector(`[data-category-index="${categoryIndex}"][data-question-index="${questionIndex}"]`);
  if (cell) {
    cell.classList.remove("board-cell-active");
    cell.classList.add("board-cell-used");
  }

  // Overlay schliessen
  if (overlayEl) overlayEl.classList.add("hidden");

  // Reset
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
    turnIndicatorEl.textContent = round >= 2 ? "Runde 2 (x2)" : "Runde 1";
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

      if (ans.isWinner) row.classList.add("estimate-winner-row");
      estimateRevealList.appendChild(row);
    });
  }

  estimateRevealContainer.classList.remove("hidden");
});

socket.on("game-ended", () => {
  joined = false;
  currentRoomCode = null;
  currentName = null;
  buzzingEnabled = false;
  isLocked = false;

  if (joinOverlay) joinOverlay.classList.remove("hidden");
  if (spectatorPage) spectatorPage.classList.add("hidden");
  if (buzzerWrap) buzzerWrap.classList.add("hidden");

  buzzBtn.disabled = true;
  setJoinStatus("Spiel beendet. Du kannst einem neuen Raum beitreten.");
  buzzStatus.textContent = "🦆 Buzzer gesperrt";
  closeEstimateModal();
  if (overlayEl) overlayEl.classList.add("hidden");
});

socket.on("disconnect", () => {
  buzzingEnabled = false;
  buzzBtn.disabled = true;
  buzzStatus.textContent = "⚠️ Verbindung getrennt...";
  closeEstimateModal();
});

// Reconnect
socket.on("connect", () => {
  const { room, name } = loadJoinFromLocalStorage();
  if (roomCodeInput && room) roomCodeInput.value = room;
  if (nameInput && name) nameInput.value = name;

  // Auto-rejoin wenn wir schon mal verbunden waren
  if (room && name && joined) {
    doJoin(room, name, { silent: true });
  }
});

// ===============================
// Init
// ===============================
(() => {
  const { room, name } = loadJoinFromLocalStorage();
  if (room && roomCodeInput) roomCodeInput.value = room;
  if (name && nameInput) nameInput.value = name;

  buildBoard();
  renderPlayersBar();

  if (turnIndicatorEl) turnIndicatorEl.textContent = "Warte auf Host…";

  // Decimal Input Setup
  if (estimateInput) {
    estimateInput.setAttribute("type", "text");
    estimateInput.setAttribute("inputmode", "decimal");
    estimateInput.setAttribute("pattern", "[0-9.,]*");
    estimateInput.setAttribute("placeholder", "z.B. 13,8 oder 1500");
  }
})();
