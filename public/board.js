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
const GAMES_MENU_URL =
  "https://1f9817b0-d9d7-4f4d-9531-2323b0787cf5-00-31mwdhe7qi072.kirk.replit.dev/";

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
    name: "Jyn Tora",
    questions: [
      {
        value: 100,
        question: "In welcher Stadt hat Jyn Tora seine Wurzeln?",
        answer: "Basel",
      },
      {
        value: 200,
        question: "Wie heißt Jyn Toras Crew / Label?",
        answer: "Baman Records",
      },
      {
        value: 300,
        question: "Welches Tier ist das Symbol von Jyn Tora?",
        answer: "Tiger",
      },
      {
        value: 400,
        question: "Wie heißt die geplante EP mit AlKo 04?",
        answer: "Echo",
      },
      {
        value: 500,
        question: "Wie lautet Jyn Toras Künstlername komplett?",
        answer: "Jyn Tora",
      },
    ],
  },
  {
    name: "Musik",
    questions: [
      {
        value: 100,
        question: "Welches Genre beschreibt Jyn Toras Sound am ehesten?",
        answer: "Deutschrap / Trap mit RAF-Camora-Vibes",
      },
      {
        value: 200,
        question: "Auf welcher Plattform released Jyn Tora u.a. seine Musik?",
        answer: "Spotify",
      },
      {
        value: 300,
        question: "Wie heißt eine Single von Jyn Tora x AlKo 04?",
        answer: "z.B. Abriss, Schatten, Sternenmeer, Sehnsucht",
      },
      {
        value: 400,
        question: "Welches Social-Media-Format ist für Promo wichtig?",
        answer: "TikTok",
      },
      {
        value: 500,
        question: "Welches große Festival ist ein Ziel von Jyn?",
        answer: "Openair Frauenfeld",
      },
    ],
  },
  {
    name: "Basel",
    questions: [
      {
        value: 100,
        question: "Wie heißt der bekannte Fußballclub aus Basel?",
        answer: "FC Basel",
      },
      {
        value: 200,
        question: "Durch welche zwei Kantone ist Basel aufgeteilt?",
        answer: "Basel-Stadt und Basel-Land",
      },
      {
        value: 300,
        question: "Welcher Fluss fließt durch Basel?",
        answer: "Rhein",
      },
      {
        value: 400,
        question: "Wie heißt das mythische Tier, das Basel symbolisiert?",
        answer: "Basilisk",
      },
      {
        value: 500,
        question: "Wie heißt das Land, in dem Basel liegt?",
        answer: "Schweiz",
      },
    ],
  },
  {
    name: "Wer oder was",
    questions: [
      {
        value: 100,
        type: "image",
        question: "Wer oder was ist das?",
        answer: "MR. BEAN",
        imageUrl: "/images/questions/werwas_100.jpg",
      },
      {
        value: 200,
        type: "image",
        question: "Wer oder was ist das?",
        answer: "Platzhalter-Antwort (du passt später an)",
        imageUrl: "/images/questions/werwas_200.jpg",
      },
      {
        value: 300,
        type: "image",
        question: "Wer oder was ist das?",
        answer: "Platzhalter-Antwort (du passt später an)",
        imageUrl: "/images/questions/werwas_300.jpg",
      },
      {
        value: 400,
        type: "image",
        question: "Wer oder was ist das?",
        answer: "Platzhalter-Antwort (du passt später an)",
        imageUrl: "/images/questions/werwas_400.jpg",
      },
      {
        value: 500,
        type: "image",
        question: "Wer oder was ist das?",
        answer: "Platzhalter-Antwort (du passt später an)",
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
        question: "Wie viele Einwohner hat Basel-Stadt ungefähr?",
        answer: "170'000",
      },
      {
        value: 200,
        type: "estimate",
        timeLimit: 30,
        question: "Wie viele Streams hat Jyn Tora insgesamt schon ungefähr?",
        answer: "24'000",
      },
      {
        value: 300,
        type: "estimate",
        timeLimit: 30,
        question:
          "Wie viele km sind es ungefähr von Basel nach Tokio (Luftlinie)?",
        answer: "9'500",
      },
      {
        value: 400,
        type: "estimate",
        timeLimit: 30,
        question:
          "Wie viele Minuten Musik veröffentlicht Jyn Tora auf der EP 'Echo' ungefähr insgesamt?",
        answer: "1'256",
      },
      {
        value: 500,
        type: "estimate",
        timeLimit: 45,
        question:
          "Wie viele Tage waren es ungefähr zwischen deinem ersten Release und heute?",
        answer: "651",
      },
    ],
  },
];

// Runde 2
const categoriesRound2 = [
  {
    name: "Echo (EP)",
    questions: [
      {
        value: 100,
        question: "Wie heißt die EP von Jyn Tora x AlKo 04?",
        answer: "Echo",
      },
      {
        value: 200,
        question: "Nenne einen Release von Jyn Tora x AlKo 04 (Song).",
        answer: "z.B. Abriss, Schatten, Sternenmeer, Sehnsucht",
      },
      {
        value: 300,
        question:
          "Wie heißt der Sommersong, der mit der ganzen EP kommen soll?",
        answer: "Ole Ole",
      },
      {
        value: 400,
        question: "Welche zwei Artists stehen bei der EP im Fokus?",
        answer: "Jyn Tora x AlKo 04",
      },
      {
        value: 500,
        question:
          "Was soll das EP-Logo/Symbol wie bei 'Palmen aus Plastik' machen?",
        answer:
          "Sich visuell durchziehen (ein wiedererkennbares Symbol über alle Assets)",
      },
    ],
  },
  {
    name: "RAF-Vibe",
    questions: [
      {
        value: 100,
        question: "Wie soll der Mix-Vibe werden (kurz): eher…?",
        answer:
          "Breit & warm (RAF-Camora-Feeling), aber eigener Jyn-Tora-Touch",
      },
      {
        value: 200,
        question: "Was ist wichtiger: 1:1 kopieren oder eigener Touch?",
        answer: "Eigener Touch behalten – nur Richtung/Ästhetik anlehnen",
      },
      {
        value: 300,
        question:
          "Welche Vocal-Elemente geben schnell 'RAF'-Energie (2 Dinge)?",
        answer: "Harmonien + Adlibs (plus breite Doubles/Stacks)",
      },
      {
        value: 400,
        question: "Welches Snippet-Feeling wird als Referenz genannt?",
        answer: "RAF/Bonez Vibes (PaP/Anthrazit-Style Snippets)",
      },
      {
        value: 500,
        question:
          "Was ist beim Gesamt-Sound besonders wichtig neben dem Main-Vocal?",
        answer: "Harmonien/Chöre & Adlibs müssen sitzen und 'leben'",
      },
    ],
  },
  {
    name: "Japan Trip",
    questions: [
      {
        value: 100,
        question: "In welcher Stadt startet eure Japan-Reise?",
        answer: "Tokio",
      },
      {
        value: 200,
        question: "Nenne 2 Orte, die fix im Plan sind.",
        answer: "z.B. Tokio, Hakone, Fuji-Gebiet, Kyoto, Osaka",
      },
      {
        value: 300,
        question: "Wie viele Leute seid ihr insgesamt?",
        answer: "6",
      },
      {
        value: 400,
        question: "Welche große Veranstaltung soll Teil des Trips sein?",
        answer: "World Expo 2025",
      },
      {
        value: 500,
        question: "Wie lange dauert die Reise ungefähr?",
        answer: "Ca. zwei Wochen",
      },
    ],
  },
  {
    name: "Baman Records",
    questions: [
      {
        value: 100,
        question: "Wie heißt das Label-Konzept von Jyn Tora?",
        answer: "Baman Records",
      },
      {
        value: 200,
        question: "Welches Tier soll beim Baman-Logo zentral sein?",
        answer: "Basilisk",
      },
      {
        value: 300,
        question: "Wofür soll die Website u.a. sein?",
        answer: "Artists präsentieren, Auftrittsdaten, Brand/Profil",
      },
      {
        value: 400,
        question:
          "Welche Plattform nutzt du zum Hochladen/Verteilen deiner Musik?",
        answer: "DistroKid",
      },
      {
        value: 500,
        question:
          "Welche 3 Kanäle sind für Promo/Presence wichtig (Beispiele)?",
        answer: "Spotify, Instagram, TikTok (auch YouTube möglich)",
      },
    ],
  },
  {
    name: "Schätzfragen 2",
    questions: [
      {
        value: 100,
        type: "estimate",
        timeLimit: 25,
        question:
          "Wie viele Sekunden hat ein TikTok-Video, das oft am besten performt (Grob)?",
        answer: "15",
      },
      {
        value: 200,
        type: "estimate",
        timeLimit: 30,
        question: "Wie viele Kategorien hat euer Jeopardy-Board pro Runde?",
        answer: "5",
      },
      {
        value: 300,
        type: "estimate",
        timeLimit: 35,
        question:
          "Wie viele Felder hat ein Board insgesamt (Kategorien x Fragen)?",
        answer: "25",
      },
      {
        value: 400,
        type: "estimate",
        timeLimit: 40,
        question:
          "Wie viele Punkte sind es in Runde 2, wenn ein Feld in Runde 1 500 hatte?",
        answer: "1'000",
      },
      {
        value: 500,
        type: "estimate",
        timeLimit: 45,
        question: "Wie viele Sekunden dauert eure Transition ungefähr (Grob)?",
        answer: "0.26",
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
  const nums = [...answerText.matchAll(/\d[\d'’.,]*/g)].map((m) =>
    Number(m[0].replace(/['’.,]/g, "")),
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
