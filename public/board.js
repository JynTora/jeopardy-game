// public/board.js
// Jeopardy-Board (Host-/Stream-Ansicht)

const socket = io();

// ===============================
// ROUND / MULTIPLIER
// ===============================
const urlParams = new URLSearchParams(window.location.search);
const ROUND = Math.max(1, Number(urlParams.get("round") || 1)); // 1 oder 2
const MULT = ROUND >= 2 ? 2 : 1; // Runde 2 = doppelte Punkte

// ===============================
// DOM-Elemente
// ===============================
const boardEl = document.getElementById("board");
const overlayEl = document.getElementById("questionOverlay");

const questionPointsWrapEl = document.getElementById("questionPoints");
const questionPointsInnerEl =
  document.querySelector("#questionPoints .points-inner") || null;

const questionTextEl = document.getElementById("questionText");
const answerTextEl = document.getElementById("answerText");

// ✅ Bildfrage-UI
const qMediaEl = document.getElementById("qMedia");
const qImageEl = document.getElementById("qImage");

// ✅ Lightbox
const lightboxEl = document.getElementById("lightbox");
const lightboxImgEl = document.getElementById("lightboxImg");
const lightboxCloseEl = document.getElementById("lightboxClose");

const showAnswerBtn = document.getElementById("showAnswerBtn");
const closeQuestionBtn = document.getElementById("closeQuestionBtn");
const wrongBtn = document.getElementById("wrongBtn");
const correctBtn = document.getElementById("correctBtn");

const playersBarEl = document.getElementById("players-bar");
const questionCardEl = document.getElementById("questionCard");
const buzzInfoEl = document.getElementById("buzzInfo");

const startGameBtn = document.getElementById("startGameBtn");
const buzzResetBtn = document.getElementById("boardBuzzResetBtn");

const estimateBoardTimerEl = document.getElementById("estimateBoardTimer");
const turnIndicatorEl = document.getElementById("turnIndicator");

// Round Switch UI (kommt aus board.html)
const roundSwitchOverlay = document.getElementById("roundSwitchOverlay");
const btnGoRound2 = document.getElementById("btnGoRound2");
const transitionOverlay = document.getElementById("boardTransitionOverlay");

// ✅ Finale Button (neu)
const btnBackToMenu = document.getElementById("btnBackToMenu");

// ✅ Ziel-URL fürs Games-Menü (dein Link)
const GAMES_MENU_URL = "https://bamangames.onrender.com/";

// ===============================
// Turn-Indikator (oben rechts)
// ===============================
function setTurnIndicator(text, spinning = false, flash = true) {
  if (!turnIndicatorEl) return;

  turnIndicatorEl.textContent = text;

  if (spinning) turnIndicatorEl.classList.add("turn-indicator-spinning");
  else turnIndicatorEl.classList.remove("turn-indicator-spinning");

  if (flash) {
    turnIndicatorEl.classList.remove("turn-indicator-flash");
    void turnIndicatorEl.offsetWidth;
    turnIndicatorEl.classList.add("turn-indicator-flash");
  }
}

// ===============================
// Reveal-UI für Schätzfragen
// ===============================
const estimateRevealContainer = document.getElementById(
  "estimateRevealContainer",
);
const estimateRevealList = document.getElementById("estimateRevealList");
const btnRevealNextEstimate = document.getElementById("btnRevealNextEstimate");
const btnPickClosest = document.getElementById("btnPickClosest");
const btnAwardClosest = document.getElementById("btnAwardClosest");

// ===============================
// Sound-Effekte
// ===============================
const sfxTick = new Audio("/sounds/tick.wav");
sfxTick.volume = 0.35;

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

function playTick() {
  safePlay(sfxTick);
}
function playBuzzSound() {
  safePlay(sfxBuzz);
}
function playCorrectSound() {
  safePlay(sfxCorrect);
}
function playWrongSound() {
  safePlay(sfxWrong);
}

// ===============================
// Bildschirm-Flash
// ===============================
function flashScreen(type) {
  const flashEl = document.getElementById("screenFlash");
  if (!flashEl) return;

  flashEl.classList.remove(
    "screen-flash-green",
    "screen-flash-red",
    "screen-flash-active",
  );

  if (type === "correct") flashEl.classList.add("screen-flash-green");
  if (type === "wrong") flashEl.classList.add("screen-flash-red");

  requestAnimationFrame(() => flashEl.classList.add("screen-flash-active"));
  setTimeout(() => flashEl.classList.remove("screen-flash-active"), 350);
}

// ===============================
// Kategorien & Fragen (Runde 1 / Runde 2)
// ===============================

// Runde 1
const categoriesRound1 = [
  {
    name: "Geographie",
    questions: [
      {
        value: 100,
        question: "Was ist die Hauptstadt von Frankreich?",
        answer: "Paris",
      },
      {
        value: 200,
        question: "Auf welchem Kontinent liegt Ägypten?",
        answer: "Afrika",
      },
      {
        value: 300,
        question: "Welcher ist der längste Fluss der Welt?",
        answer: "Nil (oder Amazonas)",
      },
      {
        value: 400,
        question: "Wie viele Bundesländer hat Deutschland?",
        answer: "16",
      },
      {
        value: 500,
        question: "Welches Land hat die meisten Einwohner der Welt?",
        answer: "Indien (seit 2023)",
      },
    ],
  },
  {
    name: "Filme & Serien",
    questions: [
      {
        value: 100,
        question: "Wie heisst der Schneemann in 'Die Eiskönigin'?",
        answer: "Olaf",
      },
      {
        value: 200,
        question: "Wer spielt Iron Man im Marvel-Universum?",
        answer: "Robert Downey Jr.",
      },
      {
        value: 300,
        question: "In welcher Stadt spielt die Serie 'Friends'?",
        answer: "New York",
      },
      {
        value: 400,
        question: "Wie heisst der Planet, auf dem die Na'vi in 'Avatar' leben?",
        answer: "Pandora",
      },
      {
        value: 500,
        question: "Welcher Film gewann 2023 den Oscar für den besten Film?",
        answer: "Everything Everywhere All at Once",
      },
    ],
  },
  {
    name: "Tamil Kultur",
    questions: [
      {
        value: 100,
        question: "Wie heisst das tamilische Neujahrsfest?",
        answer: "Puthandu (Tamil New Year)",
      },
      {
        value: 200,
        question: "Welches ist das berühmteste tamilische Erntedankfest?",
        answer: "Pongal",
      },
      {
        value: 300,
        question: "In welchem Land liegt die Heimat der tamilischen Sprache?",
        answer: "Indien (Tamil Nadu) und Sri Lanka",
      },
      {
        value: 400,
        question: "Wie heisst der traditionelle tamilische Wickelrock für Männer?",
        answer: "Veshti / Dhoti",
      },
      {
        value: 500,
        question: "Welcher berühmte Tempel in Tamil Nadu ist einer der grössten Hindutempel der Welt?",
        answer: "Meenakshi Tempel (Madurai)",
      },
    ],
  },
  {
    name: "Wer oder Was",
    questions: [
      {
        value: 100,
        type: "image",
        question: "Wer oder was ist das?",
        answer: "Mr. Bean / Rowan Atkinson",
        imageUrl: "/images/questions/werwas_100.jpg",
      },
      {
        value: 200,
        type: "image",
        question: "Wer oder was ist das?",
        answer: "Eiffelturm",
        imageUrl: "/images/questions/werwas_200.jpg",
      },
      {
        value: 300,
        type: "image",
        question: "Wer oder was ist das?",
        answer: "Dwayne The Rock Johnson",
        imageUrl: "/images/questions/werwas_300.jpg",
      },
      {
        value: 400,
        type: "image",
        question: "Wer oder was ist das?",
        answer: "Kolosseum von Rom",
        imageUrl: "/images/questions/werwas_400.jpg",
      },
      {
        value: 500,
        type: "image",
        question: "Wer oder was ist das?",
        answer: "Elon Musk",
        imageUrl: "/images/questions/werwas_500.jpg",
      },
    ],
  },
  {
    name: "Schätzfragen",
    questions: [
      {
        value: 100,
        type: "estimate",
        timeLimit: 30,
        question: "Wie viele Länder gibt es auf der Welt? (UN-Mitglieder)",
        answer: "193",
      },
      {
        value: 200,
        type: "estimate",
        timeLimit: 30,
        question: "Wie hoch ist der Eiffelturm in Metern?",
        answer: "330",
      },
      {
        value: 300,
        type: "estimate",
        timeLimit: 30,
        question: "In welchem Jahr wurde das iPhone zum ersten Mal verkauft?",
        answer: "2007",
      },
      {
        value: 400,
        type: "estimate",
        timeLimit: 30,
        question: "Wie viele Knochen hat ein erwachsener Mensch?",
        answer: "206",
      },
      {
        value: 500,
        type: "estimate",
        timeLimit: 45,
        question: "Wie viele Kilometer ist der Mond von der Erde entfernt? (Durchschnitt in Tausend)",
        answer: "384000",
      },
    ],
  },
];

// Runde 2
const categoriesRound2 = [
  {
    name: "Musik",
    questions: [
      {
        value: 100,
        question: "Aus welchem Land kommen die Beatles?",
        answer: "England / Grossbritannien",
      },
      {
        value: 200,
        question: "Wie heisst der 'King of Pop'?",
        answer: "Michael Jackson",
      },
      {
        value: 300,
        question: "Welche Sängerin ist bekannt für 'Bad Guy' und 'Lovely'?",
        answer: "Billie Eilish",
      },
      {
        value: 400,
        question: "Wie viele Saiten hat eine normale Gitarre?",
        answer: "6",
      },
      {
        value: 500,
        question: "Welcher Rapper hat das Album 'Ye' veröffentlicht?",
        answer: "Kanye West",
      },
    ],
  },
  {
    name: "Wissenschaft",
    questions: [
      {
        value: 100,
        question: "Welcher Planet ist der Sonne am nächsten?",
        answer: "Merkur",
      },
      {
        value: 200,
        question: "Was ist H2O?",
        answer: "Wasser",
      },
      {
        value: 300,
        question: "Wie viele Planeten hat unser Sonnensystem?",
        answer: "8",
      },
      {
        value: 400,
        question: "Wer hat die Relativitätstheorie entwickelt?",
        answer: "Albert Einstein",
      },
      {
        value: 500,
        question: "Was ist das häufigste Element im Universum?",
        answer: "Wasserstoff",
      },
    ],
  },
  {
    name: "Kollywood & Tamil",
    questions: [
      {
        value: 100,
        question: "Wie nennt man die tamilische Filmindustrie?",
        answer: "Kollywood",
      },
      {
        value: 200,
        question: "Welcher tamilische Schauspieler ist bekannt als 'Thalaivar' (Boss)?",
        answer: "Rajinikanth",
      },
      {
        value: 300,
        question: "Welcher tamilische Film von 2022 wurde ein weltweiter Hit mit einem Lied namens 'Naatu Naatu'?",
        answer: "RRR (Telugu, aber in Tamil synchronisiert)",
      },
      {
        value: 400,
        question: "Wie heisst der berühmte tamilische Komponist, der für 'Roja' und 'Bombay' bekannt ist?",
        answer: "A.R. Rahman",
      },
      {
        value: 500,
        question: "Welcher tamilische Schauspieler spielte die Hauptrolle in 'Vikram' (2022)?",
        answer: "Kamal Haasan",
      },
    ],
  },
  {
    name: "Wer oder Was 2",
    questions: [
      {
        value: 100,
        type: "image",
        question: "Wer oder was ist das?",
        answer: "Spongebob Schwammkopf",
        imageUrl: "/images/questions/werwas2_100.jpeg",
      },
      {
        value: 200,
        type: "image",
        question: "Wer oder was ist das?",
        answer: "Freiheitsstatue",
        imageUrl: "/images/questions/werwas2_200.jpeg",
      },
      {
        value: 300,
        type: "image",
        question: "Wer oder was ist das?",
        answer: "Rhianna",
        imageUrl: "/images/questions/werwas2_300.jpeg",
      },
      {
        value: 400,
        type: "image",
        question: "Wer oder was ist das?",
        answer: "Mark Zuckerberg",
        imageUrl: "/images/questions/werwas2_400.jpeg",
      },
      {
        value: 500,
        type: "image",
        question: "Wer oder was ist das?",
        answer: "Machu Picchu",
        imageUrl: "/images/questions/werwas2_500.jpeg",
      },
    ],
  },
  {
    name: "Schätzfragen 2",
    questions: [
      {
        value: 100,
        type: "estimate",
        timeLimit: 30,
        question: "Wie viele Zähne hat ein erwachsener Mensch normalerweise?",
        answer: "32",
      },
      {
        value: 200,
        type: "estimate",
        timeLimit: 30,
        question: "In welchem Jahr ist die Titanic gesunken?",
        answer: "1912",
      },
      {
        value: 300,
        type: "estimate",
        timeLimit: 30,
        question: "Wie viele Minuten hat ein Tag?",
        answer: "1440",
      },
      {
        value: 400,
        type: "estimate",
        timeLimit: 40,
        question: "Wie viele Instagram-Follower hat Cristiano Ronaldo ungefähr? (in Millionen)",
        answer: "620",
      },
      {
        value: 500,
        type: "estimate",
        timeLimit: 45,
        question: "Wie alt wurde Queen Elizabeth II? (in Jahren)",
        answer: "96",
      },
    ],
  },
];

// Active Set
const categories = ROUND >= 2 ? categoriesRound2 : categoriesRound1;

// ===============================
// Zustand
// ===============================
let currentQuestion = null;

let latestPlayers = {};
let activePlayerId = null;
let activePlayerName = null;
let boardRoomCode = null;

const lockedPlayersLocal = new Set();
let hasAwardedOnReveal = false;

// Turn-State (Glow unten + Anzeige oben)
let turnActivePlayerId = null;
let turnPreviewPlayerId = null;

// Schätz-Reveal-State
let estimateAnswers = {}; // playerId -> { name, value, noAnswer }
let revealOrder = [];
let revealIndex = 0;
let currentEstimateCorrectValue = null;
let currentEstimateWinnerId = null;

// Zug-Reihenfolge (wer ist dran) + Glücksrad
let turnOrder = []; // [{ id, name }]
let currentTurnIndex = 0;
let turnActive = false;
let isTurnRouletteRunning = false;

// ===============================
// Host-Timer für Schätzfragen (im Board-Overlay)
// ===============================
let estimateBoardTimerInterval = null;
let estimateBoardTimerRemaining = 0;

function stopEstimateBoardTimer() {
  if (estimateBoardTimerInterval) {
    clearInterval(estimateBoardTimerInterval);
    estimateBoardTimerInterval = null;
  }

  estimateBoardTimerRemaining = 0;

  if (estimateBoardTimerEl) {
    estimateBoardTimerEl.classList.add("hidden");
    estimateBoardTimerEl.textContent = "⏱ –";
    estimateBoardTimerEl.classList.remove("is-warning", "is-danger");
  }
}

function startEstimateBoardTimer(seconds) {
  stopEstimateBoardTimer();

  estimateBoardTimerRemaining = Number(seconds) || 0;
  if (!estimateBoardTimerEl || estimateBoardTimerRemaining <= 0) return;

  estimateBoardTimerEl.classList.remove("hidden");

  const render = () => {
    estimateBoardTimerEl.textContent = `⏱ ${estimateBoardTimerRemaining}s`;
    estimateBoardTimerEl.classList.remove("is-warning", "is-danger");

    if (estimateBoardTimerRemaining <= 5 && estimateBoardTimerRemaining > 3) {
      estimateBoardTimerEl.classList.add("is-warning");
    }
    if (estimateBoardTimerRemaining <= 3 && estimateBoardTimerRemaining > 0) {
      estimateBoardTimerEl.classList.add("is-danger");
    }
  };

  render();

  estimateBoardTimerInterval = setInterval(() => {
    estimateBoardTimerRemaining -= 1;

    if (estimateBoardTimerRemaining <= 3 && estimateBoardTimerRemaining > 0) {
      playTick();
    }

    if (estimateBoardTimerRemaining <= 0) {
      estimateBoardTimerRemaining = 0;
      render();
      clearInterval(estimateBoardTimerInterval);
      estimateBoardTimerInterval = null;
      return;
    }

    render();
  }, 1000);
}

// ===============================
// Helper – Zahl aus Answer-Text holen
// ===============================
function extractCorrectFromAnswer(answerText) {
  if (!answerText) return null;
  const nums = [...answerText.matchAll(/\d[\d''.,]*/g)].map((m) =>
    Number(m[0].replace(/[''.,]/g, "")),
  );
  if (nums.length === 0) return null;
  if (nums.length === 1) return nums[0];
  return Math.round((nums[0] + nums[1]) / 2);
}

function clearEstimateWinnerHighlight() {
  const rows = document.querySelectorAll(
    ".estimate-reveal-item.estimate-winner-row",
  );
  rows.forEach((r) => r.classList.remove("estimate-winner-row"));
}

// ===============================
// Used-Cells Persistenz (pro Room + Runde)
// ===============================
function usedKeyFor(roomCode, round) {
  return `jt-jeopardy-used::${String(roomCode || "").toUpperCase()}::round${round}`;
}

let usedCells = new Set(); // keys "c-q"

function loadUsedCells() {
  usedCells = new Set();
  if (!boardRoomCode) return;

  try {
    const raw = localStorage.getItem(usedKeyFor(boardRoomCode, ROUND));
    if (!raw) return;
    const arr = JSON.parse(raw);
    if (Array.isArray(arr)) arr.forEach((k) => usedCells.add(String(k)));
  } catch {}
}

function saveUsedCells() {
  if (!boardRoomCode) return;
  try {
    localStorage.setItem(
      usedKeyFor(boardRoomCode, ROUND),
      JSON.stringify([...usedCells]),
    );
  } catch {}
}

function totalCellCount() {
  return categories.reduce((sum, c) => sum + (c.questions?.length || 0), 0);
}

function allCellsUsed() {
  return usedCells.size >= totalCellCount();
}

// ===============================
// Spieler-Leiste unten
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

    if (id === turnPreviewPlayerId)
      pill.classList.add("player-pill-turn-preview");
    if (id === turnActivePlayerId)
      pill.classList.add("player-pill-turn-active");
    if (lockedPlayersLocal.has(id)) pill.classList.add("player-pill-locked");

    if (id === activePlayerId) {
      pill.classList.add("player-pill-active");
      pill.classList.remove("player-pill-locked");
    }

    playersBarEl.appendChild(pill);
  });
}

// ===============================
// Buzz-Info
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
// Reveal-Liste für Schätzfragen
// ===============================
function buildEstimateRevealList() {
  if (!estimateRevealContainer || !estimateRevealList) return;

  estimateRevealList.innerHTML = "";
  revealOrder = Object.keys(latestPlayers || {});
  revealIndex = 0;

  revealOrder.forEach((playerId) => {
    const player = latestPlayers[playerId];
    const ans = estimateAnswers[playerId];

    const row = document.createElement("div");
    row.className = "estimate-reveal-item";
    row.id = "estimate-row-" + playerId;

    if (!player && !ans) {
      row.textContent = "(Unbekannter Spieler)";
    } else if (!ans || ans.noAnswer) {
      const name = ans?.name || player?.name || "Unbekannt";
      row.textContent = `${name}: (keine Antwort)`;
    } else {
      row.textContent = `${ans.name}: ${ans.value}`;
    }

    estimateRevealList.appendChild(row);
  });

  estimateRevealContainer.classList.remove("hidden");

  if (btnRevealNextEstimate) {
    btnRevealNextEstimate.disabled = false;
    btnRevealNextEstimate.textContent = "Nächste Antwort anzeigen";
  }

  clearEstimateWinnerHighlight();
  currentEstimateWinnerId = null;
  if (btnAwardClosest) btnAwardClosest.disabled = true;
}

function resetEstimateRevealUI() {
  estimateAnswers = {};
  revealOrder = [];
  revealIndex = 0;
  currentEstimateCorrectValue = null;
  currentEstimateWinnerId = null;
  clearEstimateWinnerHighlight();

  if (estimateRevealContainer) estimateRevealContainer.classList.add("hidden");
  if (estimateRevealList) estimateRevealList.innerHTML = "";

  if (btnRevealNextEstimate) {
    btnRevealNextEstimate.disabled = false;
    btnRevealNextEstimate.textContent = "Nächste Antwort anzeigen";
  }
  if (btnPickClosest) btnPickClosest.disabled = true;
  if (btnAwardClosest) btnAwardClosest.disabled = true;
}

if (btnRevealNextEstimate) {
  btnRevealNextEstimate.addEventListener("click", () => {
    if (revealIndex >= revealOrder.length) return;
    const playerId = revealOrder[revealIndex];
    const row = document.getElementById("estimate-row-" + playerId);
    if (row) row.classList.add("visible");
    revealIndex++;

    if (revealIndex >= revealOrder.length) {
      btnRevealNextEstimate.disabled = true;
      btnRevealNextEstimate.textContent = "Alle Antworten angezeigt";
    }
  });
}

if (btnPickClosest) {
  btnPickClosest.addEventListener("click", () => {
    if (!currentQuestion || currentQuestion.type !== "estimate") return;

    if (currentEstimateCorrectValue == null) {
      alert(
        "Bitte zuerst 'Antwort anzeigen' drücken (damit Referenzzahl vorhanden ist).",
      );
      return;
    }

    let bestId = null;
    let bestDiff = Infinity;

    Object.entries(estimateAnswers).forEach(([playerId, ans]) => {
      if (!ans || ans.noAnswer) return;
      const val = Number(ans.value);
      if (!Number.isFinite(val)) return;
      const diff = Math.abs(val - currentEstimateCorrectValue);
      if (diff < bestDiff) {
        bestDiff = diff;
        bestId = playerId;
      }
    });

    if (!bestId) {
      alert("Keine gültigen Antworten gefunden.");
      return;
    }

    currentEstimateWinnerId = bestId;
    clearEstimateWinnerHighlight();

    const row = document.getElementById("estimate-row-" + bestId);
    if (row) row.classList.add("estimate-winner-row", "visible");

    if (btnAwardClosest) btnAwardClosest.disabled = false;
  });
}

if (btnAwardClosest) {
  btnAwardClosest.addEventListener("click", () => {
    if (!currentQuestion || currentQuestion.type !== "estimate") return;
    if (!boardRoomCode) return;

    if (!currentEstimateWinnerId) {
      alert("Bitte zuerst 'Nächsten bestimmen' drücken.");
      return;
    }

    socket.emit("board-update-score", {
      roomCode: boardRoomCode,
      playerId: currentEstimateWinnerId,
      delta: currentQuestion.value,
    });

    playCorrectSound();
    flashScreen("correct");
    hasAwardedOnReveal = true;

    closeQuestion();
  });
}

// ===============================
// Board aufbauen (Runde 1/2 + Used)
// ===============================
function buildBoard() {
  if (!boardEl) return;
  boardEl.innerHTML = "";

  categories.forEach((cat, cIndex) => {
    const col = document.createElement("div");
    col.className = "board-column";

    const header = document.createElement("div");
    header.className = "board-category";
    header.textContent = cat.name;
    col.appendChild(header);

    cat.questions.forEach((q, qIndex) => {
      const cell = document.createElement("button");
      cell.className = "board-cell";

      const displayValue = (Number(q.value) || 0) * MULT;
      cell.textContent = displayValue;

      cell.dataset.categoryIndex = String(cIndex);
      cell.dataset.questionIndex = String(qIndex);

      const usedKey = `${cIndex}-${qIndex}`;
      if (usedCells.has(usedKey)) {
        cell.disabled = true;
        cell.classList.add("board-cell-used");
      }

      cell.addEventListener("click", onCellClick);
      col.appendChild(cell);
    });

    boardEl.appendChild(col);
  });
}

function setOverlayOpen(isOpen) {
  const page = document.querySelector(".jt-page");
  if (!page) return;
  page.classList.toggle("is-overlay-open", !!isOpen);
}

function setAnswerVisible(isVisible) {
  const page = document.querySelector(".jt-page");
  if (!page) return;
  page.classList.toggle("is-answer-visible", !!isVisible);
}
// ===============================
// ✅ Bildfrage Helpers (Render + Blur + Lightbox)
// ===============================
function setBuzzLockedUI(isLocked) {
  document.body.classList.toggle("is-buzz-locked", !!isLocked);

  // Sicherheit: Lightbox immer schließen, wenn geblurrt wird
  if (isLocked) closeLightbox();
}

function clearQuestionMedia() {
  if (qImageEl) {
    qImageEl.src = "";
    qImageEl.alt = "";
  }
  if (qMediaEl) qMediaEl.classList.add("hidden");
}

function renderQuestionMedia(q) {
  clearQuestionMedia();

  if (!q) return;

  // Wir nutzen type: "image" + imageUrl
  if (q.type === "image" && q.imageUrl && qImageEl && qMediaEl) {
    qImageEl.src = q.imageUrl;
    qImageEl.alt = q.question || "Bildfrage";
    qMediaEl.classList.remove("hidden");
  }
}

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

// ✅ Lightbox Events (einmalig)
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

function onCellClick(e) {
  const cell = e.currentTarget;

  const previouslyActive = document.querySelector(".board-cell-active");
  if (previouslyActive) previouslyActive.classList.remove("board-cell-active");
  cell.classList.add("board-cell-active");

  const cIndex = Number(cell.dataset.categoryIndex);
  const qIndex = Number(cell.dataset.questionIndex);
  const data = categories[cIndex].questions[qIndex];

  const multipliedValue = (Number(data.value) || 0) * MULT;

  currentQuestion = {
    ...data,
    value: multipliedValue,
    categoryIndex: cIndex,
    questionIndex: qIndex,
    cell,
  };

  const pointsText = `${multipliedValue} Punkte`;
  if (questionPointsInnerEl) {
    questionPointsInnerEl.textContent = pointsText;
    questionPointsInnerEl.classList.remove("pop-in");
    void questionPointsInnerEl.offsetWidth;
    questionPointsInnerEl.classList.add("pop-in");
  } else if (questionPointsWrapEl) {
    questionPointsWrapEl.textContent = pointsText;
  }

  if (questionTextEl) questionTextEl.textContent = data.question || "";
  if (answerTextEl) answerTextEl.textContent = data.answer || "";

  // ✅ Bild rendern (falls Bildfrage) + Buzz-Blur zurücksetzen
  renderQuestionMedia(currentQuestion);
  setBuzzLockedUI(false);

  activePlayerId = null;
  activePlayerName = null;
  hasAwardedOnReveal = false;
  lockedPlayersLocal.clear();
  resetEstimateRevealUI();
  renderPlayersBar();
  updateBuzzInfo(false);

  if (answerTextEl) answerTextEl.classList.add("hidden");
  if (overlayEl) overlayEl.classList.remove("hidden");
  setOverlayOpen(true);
  setAnswerVisible(false);

  if (currentQuestion.type === "estimate") {
    if (wrongBtn) wrongBtn.classList.add("hidden");
    if (correctBtn) correctBtn.classList.add("hidden");
  } else {
    if (wrongBtn) wrongBtn.classList.remove("hidden");
    if (correctBtn) correctBtn.classList.remove("hidden");
  }

  if (data.type === "estimate" && boardRoomCode) {
    const limit =
      typeof data.timeLimit === "number" && data.timeLimit > 0
        ? data.timeLimit
        : 30;

    startEstimateBoardTimer(limit);

    socket.emit("board-estimate-start", {
      roomCode: boardRoomCode,
      question: data.question,
      timeLimit: limit,
    });
  } else {
    stopEstimateBoardTimer();
  }
}

function maybeShowRound2Button() {
  if (ROUND !== 1) return;
  if (!roundSwitchOverlay || !btnGoRound2) return;

  if (allCellsUsed()) {
    roundSwitchOverlay.classList.remove("hidden");
    requestAnimationFrame(() => roundSwitchOverlay.classList.add("is-visible"));
  }
}

function goToRound2() {
  if (!boardRoomCode) return;

  if (transitionOverlay) transitionOverlay.classList.add("is-active");

  const u = new URL(window.location.href);
  u.searchParams.set("room", String(boardRoomCode));
  u.searchParams.set("round", "2");

  setTimeout(() => {
    window.location.href = u.toString();
  }, 260);
}

if (btnGoRound2) {
  btnGoRound2.addEventListener("click", () => goToRound2());
}

function closeQuestion() {
  if (overlayEl) overlayEl.classList.add("hidden");
  setBuzzLockedUI(false);
  clearQuestionMedia();
  closeLightbox();
  stopEstimateBoardTimer();
  setOverlayOpen(false);
  setAnswerVisible(false);

  if (currentQuestion?.cell) {
    currentQuestion.cell.classList.remove("board-cell-active");
    currentQuestion.cell.disabled = true;
    currentQuestion.cell.classList.add("board-cell-used");

    const key = `${currentQuestion.categoryIndex}-${currentQuestion.questionIndex}`;
    usedCells.add(key);
    saveUsedCells();
  }

  if (currentQuestion?.type === "estimate" && boardRoomCode) {
    socket.emit("board-estimate-end", { roomCode: boardRoomCode });
  }

  lockedPlayersLocal.clear();
  if (boardRoomCode)
    socket.emit("board-clear-locks", { roomCode: boardRoomCode });

  activePlayerId = null;
  activePlayerName = null;
  hasAwardedOnReveal = false;
  resetEstimateRevealUI();
  renderPlayersBar();
  updateBuzzInfo(false);

  currentQuestion = null;

  if (turnActive && turnOrder.length > 0) {
    currentTurnIndex = (currentTurnIndex + 1) % turnOrder.length;
    const current = turnOrder[currentTurnIndex];
    setTurnIndicator(`⭐ ${current.name} ist dran ⭐`, false, true);

    turnActivePlayerId = current.id;
    renderPlayersBar();
  }

  // ✅ Finale prüfen (Runde 2 komplett)
  maybeShowFinalPodium();
  maybeShowRound2Button();
}

// ===============================
// Overlay-Buttons
// ===============================
if (showAnswerBtn) {
  showAnswerBtn.addEventListener("click", () => {
    if (!answerTextEl) return;

    answerTextEl.classList.remove("hidden");
    setAnswerVisible(true);
    setBuzzLockedUI(false);
    closeLightbox();

    if (currentQuestion?.type === "estimate") {
      currentEstimateCorrectValue = extractCorrectFromAnswer(
        currentQuestion.answer || "",
      );

      if (currentEstimateCorrectValue == null) {
        alert(
          "Im Answer-Text dieser Schätzfrage wurde keine Zahl gefunden.\n" +
            "Passe den Answer-Text an, z.B. 'Richtwert: ca. 24'000'.",
        );
      } else {
        if (btnPickClosest) btnPickClosest.disabled = false;
      }
      return;
    }

    if (hasAwardedOnReveal) return;
    if (!currentQuestion || !activePlayerId || !boardRoomCode) return;

    socket.emit("board-update-score", {
      roomCode: boardRoomCode,
      playerId: activePlayerId,
      delta: currentQuestion.value,
    });

    playCorrectSound();
    flashScreen("correct");
    hasAwardedOnReveal = true;
  });
}

if (closeQuestionBtn) {
  closeQuestionBtn.addEventListener("click", () => closeQuestion());
}

if (wrongBtn) {
  wrongBtn.addEventListener("click", () => {
    if (!currentQuestion || !activePlayerId || !boardRoomCode) return;

    const playerId = activePlayerId;

    // ❗️NEU: nur 50 % der Punkte abziehen
    const penalty = Math.round(currentQuestion.value / 2);

    socket.emit("board-update-score", {
      roomCode: boardRoomCode,
      playerId,
      delta: -penalty,
    });

    lockedPlayersLocal.add(playerId);
    socket.emit("board-lock-player", { roomCode: boardRoomCode, playerId });

    activePlayerId = null;
    activePlayerName = null;
    renderPlayersBar();
    updateBuzzInfo(false);

    socket.emit("board-enable-buzz", { roomCode: boardRoomCode });

    // ✅ wieder freigeben => Bild wieder sichtbar
    setBuzzLockedUI(false);
    closeLightbox();

    playWrongSound();
    flashScreen("wrong");
  });
}

if (correctBtn) {
  correctBtn.addEventListener("click", () => {
    if (!currentQuestion || !boardRoomCode) {
      closeQuestion();
      return;
    }

    if (!activePlayerId) {
      closeQuestion();
      return;
    }

    socket.emit("board-update-score", {
      roomCode: boardRoomCode,
      playerId: activePlayerId,
      delta: currentQuestion.value,
    });

    playCorrectSound();
    flashScreen("correct");

    hasAwardedOnReveal = true;
    closeQuestion();
  });
}

// ===============================
// Buzzer-Reset-Button
// ===============================
if (buzzResetBtn) {
  buzzResetBtn.addEventListener("click", () => {
    if (!boardRoomCode) return;

    lockedPlayersLocal.clear();
    activePlayerId = null;
    activePlayerName = null;
    hasAwardedOnReveal = false;

    renderPlayersBar();
    updateBuzzInfo(false);
    setBuzzLockedUI(false);
    closeLightbox();

    socket.emit("board-enable-buzz", { roomCode: boardRoomCode });
  });
}

// ===============================
// Socket.io – Events
// ===============================
socket.on("players-updated", (serverPlayers) => {
  latestPlayers = serverPlayers || {};
  renderPlayersBar();
  maybeShowFinalPodium();
});

socket.on("player-buzzed-first", (payload) => {
  const id = payload?.playerId || payload?.socketId;
  const name = payload?.name;

  if (!id) {
    console.warn("[Board] player-buzzed-first ohne Id:", payload);
    return;
  }

  activePlayerId = id;
  activePlayerName = name || (latestPlayers?.[id]?.name ?? null);

  renderPlayersBar();
  playBuzzSound();
  updateBuzzInfo(true);
  // ✅ Wenn jemand gebuzzert hat: Bild blur für alle (Board)
  setBuzzLockedUI(true);
});

socket.on("player-locked", ({ playerId }) => {
  lockedPlayersLocal.add(playerId);
  renderPlayersBar();
});

socket.on("round-reset", () => {
  lockedPlayersLocal.clear();
  activePlayerId = null;
  activePlayerName = null;
  hasAwardedOnReveal = false;
  resetEstimateRevealUI();
  renderPlayersBar();
  updateBuzzInfo(false);
  setBuzzLockedUI(false);
  closeLightbox();
  clearQuestionMedia();
});

socket.on(
  "estimate-answer-received-board",
  ({ playerId, name, value, noAnswer }) => {
    estimateAnswers[playerId] = { name, value, noAnswer };
  },
);

socket.on("estimate-all-answered", () => {
  stopEstimateBoardTimer();
  buildEstimateRevealList();
});

// ===============================
// Board in einen Raum eintragen
// ===============================
function joinRoomForBoard() {
  const params = new URLSearchParams(window.location.search);
  let roomCode = params.get("room") || "";

  if (!roomCode) roomCode = prompt("Raumcode vom Host (z.B. X59XC):") || "";
  roomCode = roomCode.trim().toUpperCase();

  if (!roomCode) {
    console.warn(
      "[Board] Kein Raumcode eingegeben – Spieler werden nicht angezeigt.",
    );
    return;
  }

  boardRoomCode = roomCode;

  loadUsedCells();

  socket.emit("board-join-room", { roomCode: boardRoomCode });
}

// ===============================
// "Spiel starten" – Glücksrad + Startspieler + Glow unten
// ===============================
if (startGameBtn) {
  startGameBtn.addEventListener("click", () => {
    if (isTurnRouletteRunning || turnActive) return;

    const entries = Object.entries(latestPlayers || {});
    if (entries.length === 0) {
      alert("Es sind noch keine Spieler verbunden.");
      return;
    }

    turnOrder = entries.map(([id, player]) => ({
      id,
      name: player.name || "Spieler",
    }));

    const len = turnOrder.length;

    isTurnRouletteRunning = true;
    let step = 0;
    const totalSteps = 18 + Math.floor(Math.random() * 10);

    function spin() {
      const displayIndex = step % len;
      const p = turnOrder[displayIndex];

      setTurnIndicator(`⭐ ${p.name} ist dran ⭐`, true, false);

      turnPreviewPlayerId = p.id;
      renderPlayersBar();

      step++;

      if (step <= totalSteps) {
        const delay = 80 + step * 15;
        setTimeout(spin, delay);
        return;
      }

      currentTurnIndex = displayIndex;
      const startPlayer = turnOrder[currentTurnIndex];

      setTurnIndicator(`⭐ ${startPlayer.name} ist dran ⭐`, false, false);

      isTurnRouletteRunning = false;
      turnActive = true;

      turnPreviewPlayerId = null;
      turnActivePlayerId = startPlayer.id;
      renderPlayersBar();

      if (startGameBtn) startGameBtn.style.display = "none";
    }

    spin();
  });
}

// ===============================
// Tastatur-Shortcuts im Overlay
// ===============================
document.addEventListener("keydown", (e) => {
  if (!overlayEl || overlayEl.classList.contains("hidden")) return;

  const t = e.target;
  const isTyping =
    t &&
    (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable);
  if (isTyping) return;

  const key = (e.key || "").toLowerCase();

  if (e.key === "Escape") {
    e.preventDefault();
    closeQuestion();
    return;
  }

  if (key === "a") {
    e.preventDefault();
    if (showAnswerBtn && !showAnswerBtn.disabled) showAnswerBtn.click();
    return;
  }

  if (key === "r") {
    e.preventDefault();
    if (
      correctBtn &&
      !correctBtn.classList.contains("hidden") &&
      !correctBtn.disabled
    ) {
      correctBtn.click();
    }
    return;
  }

  if (key === "f") {
    e.preventDefault();
    if (
      wrongBtn &&
      !wrongBtn.classList.contains("hidden") &&
      !wrongBtn.disabled
    ) {
      wrongBtn.click();
    }
    return;
  }
});

// Click auf Card (außer Buttons) -> Antwort anzeigen
if (questionCardEl) {
  questionCardEl.addEventListener("click", (e) => {
    if (e.target.closest("button")) return;
    if (!answerTextEl || !answerTextEl.classList.contains("hidden")) return;
    if (showAnswerBtn && !showAnswerBtn.disabled) showAnswerBtn.click();
  });
}

// ===============================
// Init
// ===============================
joinRoomForBoard();
buildBoard();
renderPlayersBar();
setTurnIndicator(
  ROUND === 2 ? "Runde 2 (x2) – Warte auf Spieler..." : "Warte auf Spieler...",
  false,
);
maybeShowRound2Button();

// ===============================
// FINAL PODIUM (nach Runde 2) – ROBUST + Menü-Button
// ===============================
const finalPodiumOverlay = document.getElementById("finalPodiumOverlay");
const podiumWrap = document.getElementById("podiumWrap");

const podiumFirstName = document.getElementById("podiumFirstName");
const podiumFirstScore = document.getElementById("podiumFirstScore");
const podiumSecondName = document.getElementById("podiumSecondName");
const podiumSecondScore = document.getElementById("podiumSecondScore");
const podiumThirdName = document.getElementById("podiumThirdName");
const podiumThirdScore = document.getElementById("podiumThirdScore");

const podiumThird = document.getElementById("podiumThird");

let finalShown = false;

function maybeShowFinalPodium() {
  if (finalShown) return;
  if (ROUND !== 2) return;
  if (!finalPodiumOverlay) return;

  if (!allCellsUsed()) return;

  const ranked = Object.entries(latestPlayers || {})
    .map(([id, p]) => ({ id, ...p }))
    .filter((p) => p && typeof p.score === "number")
    .sort((a, b) => (b.score || 0) - (a.score || 0))
    .slice(0, 3);

  if (ranked.length === 0) return;

  const [first, second, third] = ranked;

  if (first) {
    podiumFirstName.textContent = first.name || "Spieler";
    podiumFirstScore.textContent = `${first.score || 0} Punkte`;
  }

  if (second) {
    podiumSecondName.textContent = second.name || "Spieler";
    podiumSecondScore.textContent = `${second.score || 0} Punkte`;
  } else {
    podiumSecondName.textContent = "–";
    podiumSecondScore.textContent = "–";
  }

  if (third) {
    podiumThirdName.textContent = third.name || "Spieler";
    podiumThirdScore.textContent = `${third.score || 0} Punkte`;
    if (podiumThird) podiumThird.style.display = "";
    if (podiumWrap) podiumWrap.classList.remove("podium-two");
  } else {
    if (podiumThird) podiumThird.style.display = "none";
    if (podiumWrap) podiumWrap.classList.add("podium-two");
  }

  finalShown = true;
  finalPodiumOverlay.classList.remove("hidden");
  requestAnimationFrame(() => finalPodiumOverlay.classList.add("is-visible"));
}

// ✅ NEU: Zurück ins Menü (mit Transition)
function goBackToMenu() {
  if (transitionOverlay) transitionOverlay.classList.add("is-active");
  setTimeout(() => {
    window.location.href = GAMES_MENU_URL;
  }, 260);
}

if (btnBackToMenu) {
  btnBackToMenu.addEventListener("click", () => goBackToMenu());
}

setTimeout(() => {
  maybeShowFinalPodium();
}, 250);
