// public/board.js
// Jeopardy-Board (Host-/Stream-Ansicht) - MIT SPECTATOR SYNC

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
// Für gebildete junge Erwachsene (~26 Jahre)
// ===============================

// Runde 1 (100-500 Punkte)
const categoriesRound1 = [
  {
    name: "தமிழ் சினிமா",
    questions: [
      { value: 100, question: "\"சூப்பர் ஸ்டார்\" என்ற பட்டம் பெற்ற நடிகர் யார்?\nWelcher Schauspieler trägt den Titel \"Superstar\"?", answer: "ரஜினிகாந்த் / Rajinikanth" },
      { value: 200, question: "\"தளபதி\" என்று அன்பர்களால் அழைக்கப்படும் நடிகர் யார்?\nWelcher Schauspieler wird von Fans \"Thalapathy\" genannt?", answer: "விஜய் / Vijay" },
      { value: 300, question: "\"பொன்னியின் செல்வன்\" திரைப்படத்தின் இயக்குநர் யார்?\nWer ist der Regisseur von \"Ponniyin Selvan\"?", answer: "மணிரத்னம் / Mani Ratnam" },
      { value: 400, question: "ஆஸ்கர் விருது பெற்ற தமிழ் இசையமைப்பாளர் யார்?\nWelcher tamilische Komponist gewann einen Oscar?", answer: "ஏ.ஆர். ரஹ்மான் / A.R. Rahman" },
      { value: 500, question: "\"இந்தியன்\", \"முதல்வன்\", \"அந்நியன்\" படங்களை இயக்கியவர் யார்?\nWer führte Regie bei \"Indian\", \"Mudhalvan\" und \"Anniyan\"?", answer: "ஷங்கர் / Shankar" },
    ],
  },
  {
    name: "தமிழ் பண்பாடு",
    questions: [
      { value: 100, question: "பொங்கல் பண்டிகை எந்த மாதத்தில் கொண்டாடப்படுகிறது?\nIn welchem Monat wird das Pongal-Fest gefeiert?", answer: "ஜனவரி (தை மாதம்) / Januar" },
      { value: 200, question: "தீபாவளி அன்று காலையில் முதலில் என்ன செய்வது வழக்கம்?\nWas macht man traditionell am Deepavali-Morgen zuerst?", answer: "எண்ணெய் குளியல் / Ölbad" },
      { value: 300, question: "\"ஜல்லிக்கட்டு\" என்றால் என்ன?\nWas ist \"Jallikattu\"?", answer: "காளை அடக்கும் விளையாட்டு / Stierzähmung" },
      { value: 400, question: "தமிழ் திருமணத்தில் மணமகன் மணமகளுக்கு என்ன கட்டுவான்?\nWas bindet der Bräutigam der Braut bei einer tamilischen Hochzeit um?", answer: "தாலி / Thaali (Hochzeitskette)" },
      { value: 500, question: "தமிழ் புத்தாண்டு எந்த மாதத்தில் வருகிறது?\nIn welchem Monat ist das tamilische Neujahr?", answer: "ஏப்ரல் (சித்திரை) / April" },
    ],
  },
  {
    name: "தமிழ் உணவு",
    questions: [
      { value: 100, question: "இட்லிக்கு பொதுவாக என்ன தொட்டுக்கொள்வோம்?\nWas isst man normalerweise zu Idli dazu?", answer: "சாம்பார் & சட்னி / Sambar & Chutney" },
      { value: 200, question: "பொங்கல் பண்டிகையில் சமைக்கப்படும் இனிப்பு உணவு எது?\nWelches süsse Gericht wird an Pongal gekocht?", answer: "சர்க்கரைப் பொங்கல் / Süsser Pongal" },
      { value: 300, question: "தோசை மாவு எதிலிருந்து தயாரிக்கப்படுகிறது?\nWoraus wird Dosa-Teig hergestellt?", answer: "அரிசி & உளுந்து / Reis & Urad-Dal" },
      { value: 400, question: "\"செட்டிநாடு சிக்கன்\" எந்த பகுதியின் சிறப்பு உணவு?\nAus welcher Region stammt \"Chettinad Chicken\"?", answer: "செட்டிநாடு / Chettinad" },
      { value: 500, question: "\"பாயசம்\" செய்ய முக்கிய இனிப்புப் பொருள் என்ன?\nWas ist die wichtigste süsse Zutat für \"Payasam\"?", answer: "வெல்லம் / Jaggery (Palmzucker)" },
    ],
  },
  {
    name: "யார் இது?",
    questions: [
      { value: 100, type: "image", question: "இவர் யார்? / Wer ist das?", answer: "ரஜினிகாந்த் / Rajinikanth", imageUrl: "/images/questions/r1_wer_100.jpg" },
      { value: 200, type: "image", question: "இவர் யார்? / Wer ist das?", answer: "ஏ.ஆர். ரஹ்மான் / A.R. Rahman", imageUrl: "/images/questions/r1_wer_200.jpg" },
      { value: 300, type: "image", question: "இவர் யார்? / Wer ist das?", answer: "லியோனல் மெஸ்ஸி / Lionel Messi", imageUrl: "/images/questions/r1_wer_300.jpg" },
      { value: 400, type: "image", question: "இவர் யார்? / Wer ist das?", answer: "சிவாஜி கணேசன் / Sivaji Ganesan", imageUrl: "/images/questions/r1_wer_400.jpg" },
      { value: 500, type: "image", question: "இது என்ன இடம்? / Was ist das für ein Ort?", answer: "தாஜ் மஹால் / Taj Mahal", imageUrl: "/images/questions/r1_wer_500.jpg" },
    ],
  },
  {
    name: "மதிப்பீடு",
    questions: [
      { value: 100, type: "estimate", timeLimit: 30, question: "தமிழ் மொழி எத்தனை ஆண்டுகள் பழமையானது?\nWie viele Jahre alt ist die tamilische Sprache?", answer: "2500" },
      { value: 200, type: "estimate", timeLimit: 30, question: "தமிழ்நாட்டின் மக்கள் தொகை எவ்வளவு கோடி?\nWie viele Crore Einwohner hat Tamil Nadu? (1 Crore = 10 Mio.)", answer: "8" },
      { value: 300, type: "estimate", timeLimit: 30, question: "ரஜினிகாந்த் இதுவரை எத்தனை படங்களில் நடித்துள்ளார்?\nIn wie vielen Filmen hat Rajinikanth mitgespielt?", answer: "170" },
      { value: 400, type: "estimate", timeLimit: 35, question: "உலகில் எத்தனை கோடி பேர் தமிழ் பேசுகிறார்கள்?\nWie viele Crore Menschen weltweit sprechen Tamil?", answer: "8" },
      { value: 500, type: "estimate", timeLimit: 40, question: "சென்னையின் மக்கள் தொகை எத்தனை லட்சம்?\nWie viele Lakh Einwohner hat Chennai? (1 Lakh = 100'000)", answer: "100" },
    ],
  },
];

// Runde 2 (200-1000 Punkte, x2 Multiplikator)
const categoriesRound2 = [
  {
    name: "பொது அறிவு",
    questions: [
      { value: 100, question: "உலகின் மிகப்பெரிய கடல் எது?\nWelcher ist der grösste Ozean der Welt?", answer: "பசிபிக் பெருங்கடல் / Pazifik" },
      { value: 200, question: "ஐபிள் கோபுரம் எந்த நாட்டில் உள்ளது?\nIn welchem Land steht der Eiffelturm?", answer: "பிரான்ஸ் (பாரிஸ்) / Frankreich (Paris)" },
      { value: 300, question: "ஒரு கால்பந்து அணியில் எத்தனை பேர் விளையாடுவார்கள்?\nWie viele Spieler hat eine Fussballmannschaft?", answer: "11" },
      { value: 400, question: "பூமியிலிருந்து சந்திரனுக்குச் செல்ல முதல் மனிதன் யார்?\nWer war der erste Mensch auf dem Mond?", answer: "நீல் ஆர்ம்ஸ்ட்ராங் / Neil Armstrong" },
      { value: 500, question: "\"மோனா லிசா\" ஓவியத்தை வரைந்தவர் யார்?\nWer hat die \"Mona Lisa\" gemalt?", answer: "லியனார்டோ டா வின்சி / Leonardo da Vinci" },
    ],
  },
  {
    name: "தமிழ்நாடு",
    questions: [
      { value: 100, question: "மதுரையின் புகழ்பெற்ற கோயில் எது?\nWelcher berühmte Tempel steht in Madurai?", answer: "மீனாட்சி அம்மன் கோயில் / Meenakshi Tempel" },
      { value: 200, question: "ஊட்டியின் மற்றொரு பெயர் என்ன?\nWie lautet der andere Name von Ooty?", answer: "உதகமண்டலம் / Udhagamandalam" },
      { value: 300, question: "\"கோவில் நகரம்\" என்று அழைக்கப்படும் நகரம் எது?\nWelche Stadt wird \"Tempelstadt\" genannt?", answer: "காஞ்சிபுரம் / Kanchipuram" },
      { value: 400, question: "ராமேஸ்வரம் எதற்கு புகழ்பெற்றது?\nWofür ist Rameswaram berühmt?", answer: "ராமநாதசுவாமி கோயில் / Ramanathaswamy Tempel" },
      { value: 500, question: "தமிழ்நாட்டின் மிக நீளமான நதி எது?\nWelcher ist der längste Fluss in Tamil Nadu?", answer: "காவிரி / Kaveri" },
    ],
  },
  {
    name: "விளையாட்டு & உலகம்",
    questions: [
      { value: 100, question: "ஒலிம்பிக் போட்டிகள் எத்தனை ஆண்டுகளுக்கு ஒருமுறை நடைபெறும்?\nAlle wie viele Jahre finden die Olympischen Spiele statt?", answer: "4 ஆண்டுகள் / 4 Jahre" },
      { value: 200, question: "கிரிக்கெட்டில் ஒரு ஓவரில் எத்தனை பந்துகள் வீசப்படும்?\nWie viele Bälle hat ein Over im Cricket?", answer: "6" },
      { value: 300, question: "உலகின் மிக உயரமான மலை எது?\nWelcher ist der höchste Berg der Welt?", answer: "எவரெஸ்ட் / Mount Everest" },
      { value: 400, question: "சாக்லெட் எந்த கொட்டையிலிருந்து தயாரிக்கப்படுகிறது?\nAus welcher Bohne wird Schokolade hergestellt?", answer: "கொக்கோ கொட்டை / Kakaobohne" },
      { value: 500, question: "ஸ்விட்சர்லாந்தின் தலைநகரம் எது?\nWie heisst die Hauptstadt der Schweiz?", answer: "பெர்ன் / Bern" },
    ],
  },
  {
    name: "யார்/என்ன இது?",
    questions: [
      { value: 100, type: "image", question: "இவர் யார்? / Wer ist das?", answer: "விஜய் / Vijay", imageUrl: "/images/questions/r2_wer_100.jpg" },
      { value: 200, type: "image", question: "இது என்ன கோயில்? / Was ist das für ein Tempel?", answer: "மீனாட்சி அம்மன் கோயில் / Meenakshi Tempel", imageUrl: "/images/questions/r2_wer_200.jpg" },
      { value: 300, type: "image", question: "இவர் யார்? / Wer ist das?", answer: "தனுஷ் / Dhanush", imageUrl: "/images/questions/r2_wer_300.jpg" },
      { value: 400, type: "image", question: "இது என்ன கோயில்? / Was ist das für ein Tempel?", answer: "தஞ்சை பெரிய கோயில் / Thanjavur Big Temple", imageUrl: "/images/questions/r2_wer_400.jpg" },
      { value: 500, type: "image", question: "இவர் யார்? / Wer ist das?", answer: "கமல்ஹாசன் / Kamal Haasan", imageUrl: "/images/questions/r2_wer_500.jpg" },
    ],
  },
  {
    name: "மதிப்பீடு",
    questions: [
      { value: 100, type: "estimate", timeLimit: 30, question: "திருக்குறளில் எத்தனை குறள்கள் உள்ளன?\nWie viele Verse enthält das Thirukkural?", answer: "1330" },
      { value: 200, type: "estimate", timeLimit: 30, question: "ஏ.ஆர். ரஹ்மான் எத்தனை படங்களுக்கு இசையமைத்துள்ளார்?\nFür wie viele Filme hat A.R. Rahman Musik komponiert? (ca.)", answer: "150" },
      { value: 300, type: "estimate", timeLimit: 30, question: "தமிழ் சினிமாவின் முதல் படம் எந்த வருடம் வெளியானது?\nIn welchem Jahr erschien der erste tamilische Film?", answer: "1931" },
      { value: 400, type: "estimate", timeLimit: 35, question: "இலங்கையில் எத்தனை சதவீத மக்கள் தமிழர்கள்?\nWie viel Prozent der Bevölkerung Sri Lankas sind Tamilen?", answer: "15" },
      { value: 500, type: "estimate", timeLimit: 40, question: "தமிழில் மொத்தம் எத்தனை எழுத்துக்கள் உள்ளன?\nWie viele Buchstaben hat das tamilische Alphabet?", answer: "247" },
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

// Turn-State
let turnActivePlayerId = null;
let turnPreviewPlayerId = null;

// Schätz-Reveal-State
let estimateAnswers = {};
let revealOrder = [];
let revealIndex = 0;
let currentEstimateCorrectValue = null;
let currentEstimateWinnerId = null;

// Zug-Reihenfolge
let turnOrder = [];
let currentTurnIndex = 0;
let turnActive = false;
let isTurnRouletteRunning = false;

// ===============================
// Host-Timer für Schätzfragen
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
    if (estimateBoardTimerRemaining <= 5 && estimateBoardTimerRemaining > 3) estimateBoardTimerEl.classList.add("is-warning");
    if (estimateBoardTimerRemaining <= 3 && estimateBoardTimerRemaining > 0) estimateBoardTimerEl.classList.add("is-danger");
  };

  render();

  estimateBoardTimerInterval = setInterval(() => {
    estimateBoardTimerRemaining -= 1;
    if (estimateBoardTimerRemaining <= 3 && estimateBoardTimerRemaining > 0) playTick();
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
// Helper Functions
// ===============================
function extractCorrectFromAnswer(answerText) {
  if (!answerText) return null;
  const nums = [...answerText.matchAll(/\d[\d''.,]*/g)].map((m) => Number(m[0].replace(/[''.,]/g, "")));
  if (nums.length === 0) return null;
  if (nums.length === 1) return nums[0];
  return Math.round((nums[0] + nums[1]) / 2);
}

function clearEstimateWinnerHighlight() {
  const rows = document.querySelectorAll(".estimate-reveal-item.estimate-winner-row");
  rows.forEach((r) => r.classList.remove("estimate-winner-row"));
}

// ===============================
// Used-Cells Persistenz
// ===============================
function usedKeyFor(roomCode, round) {
  return `jt-jeopardy-used::${String(roomCode || "").toUpperCase()}::round${round}`;
}

let usedCells = new Set();

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
    localStorage.setItem(usedKeyFor(boardRoomCode, ROUND), JSON.stringify([...usedCells]));
  } catch {}
}

function totalCellCount() {
  return categories.reduce((sum, c) => sum + (c.questions?.length || 0), 0);
}

function allCellsUsed() {
  return usedCells.size >= totalCellCount();
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

    if (id === turnPreviewPlayerId) pill.classList.add("player-pill-turn-preview");
    if (id === turnActivePlayerId) pill.classList.add("player-pill-turn-active");
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
// Estimate Reveal
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

// ✅ NEU: Estimate Reveal an Spectators senden
function sendEstimateRevealToSpectators() {
  if (!boardRoomCode) return;
  const answersArray = revealOrder.map((playerId) => {
    const ans = estimateAnswers[playerId];
    const player = latestPlayers[playerId];
    return {
      playerId,
      name: ans?.name || player?.name || "Unbekannt",
      value: ans?.value,
      noAnswer: ans?.noAnswer || false,
      isWinner: playerId === currentEstimateWinnerId,
    };
  });
  socket.emit("board-estimate-reveal", { roomCode: boardRoomCode, answers: answersArray });
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
      sendEstimateRevealToSpectators();
    }
  });
}

if (btnPickClosest) {
  btnPickClosest.addEventListener("click", () => {
    if (!currentQuestion || currentQuestion.type !== "estimate") return;
    if (currentEstimateCorrectValue == null) {
      alert("Bitte zuerst 'Antwort anzeigen' drücken.");
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
    sendEstimateRevealToSpectators();
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

    socket.emit("board-update-score", { roomCode: boardRoomCode, playerId: currentEstimateWinnerId, delta: currentQuestion.value });
    playCorrectSound();
    flashScreen("correct");
    hasAwardedOnReveal = true;
    socket.emit("board-correct", { roomCode: boardRoomCode });
    closeQuestion();
  });
}

// ===============================
// Board bauen
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
// Bildfrage Helpers
// ===============================
function setBuzzLockedUI(isLocked) {
  document.body.classList.toggle("is-buzz-locked", !!isLocked);
  if (isLocked) closeLightbox();
}

function clearQuestionMedia() {
  if (qImageEl) { qImageEl.src = ""; qImageEl.alt = ""; }
  if (qMediaEl) qMediaEl.classList.add("hidden");
}

function renderQuestionMedia(q) {
  clearQuestionMedia();
  if (!q) return;
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
// Cell Click Handler
// ===============================
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

  if (questionCardEl) {
    if (data.type === "estimate") {
      questionCardEl.classList.add("is-estimate-question");
    } else {
      questionCardEl.classList.remove("is-estimate-question");
    }
  }

  if (answerTextEl) answerTextEl.textContent = data.answer || "";

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
    const limit = typeof data.timeLimit === "number" && data.timeLimit > 0 ? data.timeLimit : 30;
    startEstimateBoardTimer(limit);
    socket.emit("board-estimate-start", { roomCode: boardRoomCode, question: data.question, timeLimit: limit });
  } else {
    stopEstimateBoardTimer();
  }

  // ✅ NEU: Frage an Spectators senden
  if (boardRoomCode) {
    socket.emit("board-question-opened", {
      roomCode: boardRoomCode,
      categoryIndex: cIndex,
      questionIndex: qIndex,
      question: data.question,
      answer: data.answer,
      value: multipliedValue,
      type: data.type || "normal",
      imageUrl: data.imageUrl || null,
      timeLimit: data.timeLimit || null,
    });
  }
}

// ===============================
// Round Switch
// ===============================
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
  socket.emit("board-round-changed", { roomCode: boardRoomCode, round: 2 });
  if (transitionOverlay) transitionOverlay.classList.add("is-active");

  const u = new URL(window.location.href);
  u.searchParams.set("room", String(boardRoomCode));
  u.searchParams.set("round", "2");

  setTimeout(() => { window.location.href = u.toString(); }, 260);
}

if (btnGoRound2) {
  btnGoRound2.addEventListener("click", () => goToRound2());
}

// ===============================
// Close Question
// ===============================
function closeQuestion() {
  // ✅ NEU: Frage geschlossen an Spectators senden
  if (boardRoomCode && currentQuestion) {
    socket.emit("board-question-closed", {
      roomCode: boardRoomCode,
      categoryIndex: currentQuestion.categoryIndex,
      questionIndex: currentQuestion.questionIndex,
    });
  }

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
  if (boardRoomCode) socket.emit("board-clear-locks", { roomCode: boardRoomCode });

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

    // ✅ NEU: Turn-Update an Spectators
    if (boardRoomCode) {
      socket.emit("board-turn-update", { roomCode: boardRoomCode, playerName: current.name, playerId: current.id });
    }
  }

  maybeShowFinalPodium();
  maybeShowRound2Button();
}

// ===============================
// Overlay Buttons
// ===============================
if (showAnswerBtn) {
  showAnswerBtn.addEventListener("click", () => {
    if (!answerTextEl) return;

    answerTextEl.classList.remove("hidden");
    setAnswerVisible(true);
    setBuzzLockedUI(false);
    closeLightbox();

    // ✅ NEU: Antwort an Spectators senden
    if (boardRoomCode && currentQuestion) {
      socket.emit("board-answer-shown", { roomCode: boardRoomCode, answer: currentQuestion.answer || "" });
    }

    if (currentQuestion?.type === "estimate") {
      currentEstimateCorrectValue = extractCorrectFromAnswer(currentQuestion.answer || "");
      if (currentEstimateCorrectValue == null) {
        alert("Im Answer-Text wurde keine Zahl gefunden.");
      } else {
        if (btnPickClosest) btnPickClosest.disabled = false;
      }
      return;
    }

    if (hasAwardedOnReveal) return;
    if (!currentQuestion || !activePlayerId || !boardRoomCode) return;

    socket.emit("board-update-score", { roomCode: boardRoomCode, playerId: activePlayerId, delta: currentQuestion.value });
    playCorrectSound();
    flashScreen("correct");
    hasAwardedOnReveal = true;
    socket.emit("board-correct", { roomCode: boardRoomCode });
  });
}

if (closeQuestionBtn) {
  closeQuestionBtn.addEventListener("click", () => closeQuestion());
}

if (wrongBtn) {
  wrongBtn.addEventListener("click", () => {
    if (!currentQuestion || !activePlayerId || !boardRoomCode) return;
    const playerId = activePlayerId;
    const penalty = Math.round(currentQuestion.value / 2);

    socket.emit("board-update-score", { roomCode: boardRoomCode, playerId, delta: -penalty });
    lockedPlayersLocal.add(playerId);
    socket.emit("board-lock-player", { roomCode: boardRoomCode, playerId });

    activePlayerId = null;
    activePlayerName = null;
    renderPlayersBar();
    updateBuzzInfo(false);
    socket.emit("board-enable-buzz", { roomCode: boardRoomCode });
    setBuzzLockedUI(false);
    closeLightbox();
    playWrongSound();
    flashScreen("wrong");
    socket.emit("board-wrong", { roomCode: boardRoomCode });
  });
}

if (correctBtn) {
  correctBtn.addEventListener("click", () => {
    if (!currentQuestion || !boardRoomCode) { closeQuestion(); return; }
    if (!activePlayerId) { closeQuestion(); return; }

    socket.emit("board-update-score", { roomCode: boardRoomCode, playerId: activePlayerId, delta: currentQuestion.value });
    playCorrectSound();
    flashScreen("correct");
    socket.emit("board-correct", { roomCode: boardRoomCode });
    hasAwardedOnReveal = true;
    closeQuestion();
  });
}

// ===============================
// Buzzer Reset Button
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
// Socket Events
// ===============================
socket.on("players-updated", (serverPlayers) => {
  latestPlayers = serverPlayers || {};
  renderPlayersBar();
  maybeShowFinalPodium();
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

socket.on("estimate-answer-received-board", ({ playerId, name, value, noAnswer }) => {
  estimateAnswers[playerId] = { name, value, noAnswer };
});

socket.on("estimate-all-answered", () => {
  stopEstimateBoardTimer();
  buildEstimateRevealList();
});

// ===============================
// Join Room
// ===============================
function joinRoomForBoard() {
  const params = new URLSearchParams(window.location.search);
  let roomCode = params.get("room") || "";
  if (!roomCode) roomCode = prompt("Raumcode vom Host (z.B. X59XC):") || "";
  roomCode = roomCode.trim().toUpperCase();

  if (!roomCode) {
    console.warn("[Board] Kein Raumcode eingegeben.");
    return;
  }

  boardRoomCode = roomCode;
  loadUsedCells();
  socket.emit("board-join-room", { roomCode: boardRoomCode });
  socket.emit("board-round-changed", { roomCode: boardRoomCode, round: ROUND });
}

// ===============================
// Start Game (Roulette)
// ===============================
if (startGameBtn) {
  startGameBtn.addEventListener("click", () => {
    if (isTurnRouletteRunning || turnActive) return;
    const entries = Object.entries(latestPlayers || {});
    if (entries.length === 0) {
      alert("Es sind noch keine Spieler verbunden.");
      return;
    }

    turnOrder = entries.map(([id, player]) => ({ id, name: player.name || "Spieler" }));
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
      
      // Send preview to spectators for smooth animation
      if (boardRoomCode) {
        socket.emit("board-turn-preview", { roomCode: boardRoomCode, playerName: p.name, playerId: p.id });
      }
      
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

      if (boardRoomCode) {
        socket.emit("board-turn-update", { roomCode: boardRoomCode, playerName: startPlayer.name, playerId: startPlayer.id });
      }
      if (startGameBtn) startGameBtn.style.display = "none";
    }
    spin();
  });
}

// ===============================
// Keyboard Shortcuts
// ===============================
document.addEventListener("keydown", (e) => {
  if (!overlayEl || overlayEl.classList.contains("hidden")) return;
  const t = e.target;
  const isTyping = t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable);
  if (isTyping) return;

  const key = (e.key || "").toLowerCase();
  if (e.key === "Escape") { e.preventDefault(); closeQuestion(); return; }
  if (key === "a") { e.preventDefault(); if (showAnswerBtn && !showAnswerBtn.disabled) showAnswerBtn.click(); return; }
  if (key === "r") { e.preventDefault(); if (correctBtn && !correctBtn.classList.contains("hidden") && !correctBtn.disabled) correctBtn.click(); return; }
  if (key === "f") { e.preventDefault(); if (wrongBtn && !wrongBtn.classList.contains("hidden") && !wrongBtn.disabled) wrongBtn.click(); return; }
});

if (questionCardEl) {
  questionCardEl.addEventListener("click", (e) => {
    if (e.target.closest("button")) return;
    if (e.target.closest(".q-media")) return;
    if (e.target.closest("#qImage")) return;
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
setTurnIndicator(ROUND === 2 ? "Runde 2 (x2) – Warte auf Spieler..." : "Warte auf Spieler...", false);
maybeShowRound2Button();

// ===============================
// Final Podium
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

function goBackToMenu() {
  if (transitionOverlay) transitionOverlay.classList.add("is-active");
  setTimeout(() => { window.location.href = GAMES_MENU_URL; }, 260);
}

if (btnBackToMenu) {
  btnBackToMenu.addEventListener("click", () => goBackToMenu());
}

setTimeout(() => { maybeShowFinalPodium(); }, 250);
