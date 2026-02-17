// public/board-teams.js
// Host Board für Jeopardy Teams Modus (OHNE Kamera)

const socket = io();

// ===============================
// Get Room Code from URL
// ===============================
const urlParams = new URLSearchParams(window.location.search);
const boardRoomCode = urlParams.get("room")?.toUpperCase();

if (!boardRoomCode) {
  alert("Kein Raumcode angegeben!");
  window.location.href = "/jeopardy-teams.html";
}

// ===============================
// DOM Elements
// ===============================
const boardEl              = document.getElementById("board");
const teamsBar             = document.getElementById("teamsBar");
const turnIndicatorEl      = document.getElementById("turnIndicator");
const startGameBtn         = document.getElementById("startGameBtn");
const overlayEl            = document.getElementById("questionOverlay");
const questionPointsInnerEl = document.querySelector("#questionPoints .points-inner");
const questionTextEl       = document.getElementById("questionText");
const answerTextEl         = document.getElementById("answerText");
const buzzInfoEl           = document.getElementById("buzzInfo");
const showAnswerBtn        = document.getElementById("showAnswerBtn");
const wrongBtn             = document.getElementById("wrongBtn");
const correctBtn           = document.getElementById("correctBtn");
const closeQuestionBtn     = document.getElementById("closeQuestionBtn");
const buzzResetBtn         = document.getElementById("boardBuzzBtn");
const estimateBoardTimerEl = document.getElementById("estimateBoardTimer");
const qMediaEl             = document.getElementById("qMedia");
const qImageEl             = document.getElementById("qImage");
const lightboxEl           = document.getElementById("lightbox");
const lightboxImgEl        = document.getElementById("lightboxImg");
const lightboxCloseEl      = document.getElementById("lightboxClose");
const estimateRevealContainer = document.getElementById("estimateRevealContainer");
const estimateRevealList   = document.getElementById("estimateRevealList");
const pickOverlay          = document.getElementById("pickOverlay");
const pickName             = document.getElementById("pickName");
const pickSub              = document.getElementById("pickSub");
const pickResult           = document.getElementById("pickResult");
const pickCloseBtn         = document.getElementById("pickCloseBtn");

// ===============================
// Audio
// ===============================
const sfxBuzz    = new Audio("/sounds/buzzer-button.wav");
const sfxCorrect = new Audio("/sounds/correct-sound.wav");
const sfxWrong   = new Audio("/sounds/wrong-sound.wav");
[sfxBuzz, sfxCorrect, sfxWrong].forEach(s => s.preload = "auto");

function safePlay(sound) {
  sound.currentTime = 0;
  sound.play().catch(() => {});
}

// ===============================
// State
// ===============================
let teams           = {};
let players         = {};
let activePlayerId  = null;
let activePlayerName = null;
let activeTeamId    = null;
let currentRound    = 1;
let usedCells       = new Set();
let currentQuestion = null;
let hasAwardedOnReveal = false;
let lockedPlayersLocal = new Set();
let gameStarted     = false;
let teamOrder       = [];
let currentTeamIndex = 0;

// Estimate
let estimateAnswers = {};
let estimateBoardTimerInterval = null;

// Team color map
const TEAM_COLORS_HEX = {
  red: '#f87171', blue: '#60a5fa', green: '#4ade80',
  purple: '#c084fc', orange: '#fb923c', pink: '#f472b6'
};

// ===============================
// Categories (unverändert)
// ===============================
const categoriesRound1 = [
  { name: "தமிழ் சினிமா", questions: [
    { value: 100, question: "\"சூப்பர் ஸ்டார்\" என்ற பட்டம் பெற்ற நடிகர் யார்?\nWelcher Schauspieler trägt den Titel \"Superstar\"?", answer: "ரஜினிகாந்த் / Rajinikanth", type: "text" },
    { value: 200, question: "\"நான் கடவுள்\" படத்தில் ஆர்யா ஏற்ற வேடம் என்ன?\nWelche Rolle spielte Arya im Film \"Naan Kadavul\"?", answer: "அகோரி / Aghori (Bettelmönch)", type: "text" },
    { value: 300, question: "A.R. ரஹ்மான் இசையமைத்த முதல் தமிழ் படம் எது?\nWas war der erste Tamil-Film, für den A.R. Rahman die Musik komponierte?", answer: "ரோஜா / Roja", type: "text" },
    { value: 400, question: "\"விக்ரம்\" படத்தில் கமல்ஹாசன் ஏற்ற கதாபாத்திரத்தின் பெயர் என்ன?\nWie heisst Kamal Haasans Charakter im Film \"Vikram\"?", answer: "கர்ணன் / Karnan", type: "text" },
    { value: 500, question: "சிவாஜி கணேசன் நடித்த முதல் திரைப்படம் எது?\nWas war der erste Film, in dem Sivaji Ganesan mitspielte?", answer: "பராசக்தி / Parasakthi", type: "text" },
  ]},
  { name: "தமிழ் பண்பாடு", questions: [
    { value: 100, question: "தமிழர்களின் முக்கிய அறுவடை திருநாள் எது?\nWas ist das wichtigste Erntefest der Tamilen?", answer: "பொங்கல் / Pongal", type: "text" },
    { value: 200, question: "பாரம்பரிய தமிழ் வீடுகளில் வாசலில் வரையப்படும் கலை வடிவம் எது?\nWelche Kunstform wird am Eingang traditioneller tamilischer Häuser gezeichnet?", answer: "கோலம் / Kolam", type: "text" },
    { value: 300, question: "தமிழ் திருமணங்களில் மணமகளின் கழுத்தில் கட்டப்படும் புனித நூல் எது?\nWie heisst der heilige Faden, der bei tamilischen Hochzeiten um den Hals der Braut gebunden wird?", answer: "தாலி / Thali", type: "text" },
    { value: 400, question: "\"செம்மொழி\" என்று அழைக்கப்படும் மொழி எது?\nWelche Sprache wird als \"klassische Sprache\" bezeichnet?", answer: "தமிழ் / Tamil", type: "text" },
    { value: 500, question: "சங்க இலக்கியத்தில் எத்தனை நூல்கள் உள்ளன?\nWie viele Werke umfasst die Sangam-Literatur?", answer: "18 நூல்கள் / 18 Werke", type: "text" },
  ]},
  { name: "தமிழ் உணவு", questions: [
    { value: 100, question: "தோசை வார்க்க பயன்படும் பாத்திரம் எது?\nWelches Kochgerät wird zum Braten von Dosa verwendet?", answer: "தவா / Tawa", type: "text" },
    { value: 200, question: "சாம்பார் தயாரிக்க முக்கியமாக தேவைப்படும் பருப்பு வகை எது?\nWelche Linsenart wird hauptsächlich für die Zubereitung von Sambar verwendet?", answer: "துவரம் பருப்பு / Toor Dal", type: "text" },
    { value: 300, question: "\"சாப்பாடு\" என்றால் என்ன?\nWas bedeutet \"Saappaadu\"?", answer: "சோறு / Essen/Reis (Mahlzeit)", type: "text" },
    { value: 400, question: "சோறு சாப்பிட பாரம்பரியமாக எந்த இலையை பயன்படுத்துவார்கள்?\nWelches Blatt wird traditionell als Teller für Reis verwendet?", answer: "வாழை இலை / Bananenblatt", type: "text" },
    { value: 500, question: "\"காரசேவ்\" எந்த மாவில் செய்யப்படுகிறது?\nAus welchem Mehl wird \"Karasev\" hergestellt?", answer: "கடலை மாவு / Kichererbsenmehl", type: "text" },
  ]},
  { name: "யார் இது?", questions: [
    { value: 100, question: "இவர் யார்?", answer: "விஜய் / Vijay", type: "image", imageUrl: "/images/celeb1.jpg" },
    { value: 200, question: "இவர் யார்?", answer: "தனுஷ் / Dhanush", type: "image", imageUrl: "/images/celeb2.jpg" },
    { value: 300, question: "இவர் யார்?", answer: "சூர்யா / Suriya", type: "image", imageUrl: "/images/celeb3.jpg" },
    { value: 400, question: "இவர் யார்?", answer: "அஜித் குமார் / Ajith Kumar", type: "image", imageUrl: "/images/celeb4.jpg" },
    { value: 500, question: "இவர் யார்?", answer: "கமல்ஹாசன் / Kamal Haasan", type: "image", imageUrl: "/images/celeb5.jpg" },
  ]},
  { name: "மதிப்பீடு", questions: [
    { value: 100, question: "தமிழ் நாட்டின் மக்கள் தொகை எவ்வளவு (மில்லியனில்)?\nWie hoch ist die Bevölkerung von Tamil Nadu (in Millionen)?", answer: "78 மில்லியன் / 78 Millionen", type: "estimate", timeLimit: 30 },
    { value: 200, question: "சென்னையில் ஒரு நாளில் சராசரியாக எத்தனை இட்லிகள் விற்கப்படுகின்றன?\nWie viele Idlis werden in Chennai durchschnittlich pro Tag verkauft?", answer: "5 மில்லியன் / 5 Millionen", type: "estimate", timeLimit: 30 },
    { value: 300, question: "தமிழ் மொழியின் வயது எத்தனை ஆண்டுகள்?\nWie alt ist die tamilische Sprache (in Jahren)?", answer: "2500+ ஆண்டுகள் / 2500+ Jahre", type: "estimate", timeLimit: 30 },
    { value: 400, question: "2023-இல் \"ஜெய்லர்\" படம் எவ்வளவு கோடி வசூல் செய்தது?\nWie viel Crore hat \"Jailer\" 2023 eingespielt?", answer: "600+ கோடி / 600+ Crore", type: "estimate", timeLimit: 30 },
    { value: 500, question: "மெரினா கடற்கரையின் நீளம் எத்தனை கி.மீ?\nWie lang ist der Marina Beach in Kilometern?", answer: "13 கி.மீ. / 13 km", type: "estimate", timeLimit: 30 },
  ]},
];

const categoriesRound2 = [
  { name: "பொது அறிவு", questions: [
    { value: 100, question: "உலகின் மிகப்பெரிய கடல் எது?\nWelches ist der grösste Ozean der Welt?", answer: "பசிபிக் பெருங்கடல் / Pazifischer Ozean", type: "text" },
    { value: 200, question: "மனித உடலில் மொத்தம் எத்தனை எலும்புகள் உள்ளன?\nWie viele Knochen hat der menschliche Körper?", answer: "206 எலும்புகள் / 206 Knochen", type: "text" },
    { value: 300, question: "ஐபிள் கோபுரம் எந்த நாட்டில் உள்ளது?\nIn welchem Land steht der Eiffelturm?", answer: "பிரான்ஸ் / Frankreich", type: "text" },
    { value: 400, question: "\"E = mc²\" என்ற சூத்திரத்தை கண்டுபிடித்தவர் யார்?\nWer entdeckte die Formel \"E = mc²\"?", answer: "ஐன்ஸ்டீன் / Einstein", type: "text" },
    { value: 500, question: "உலகின் மிக நீளமான நதி எது?\nWelches ist der längste Fluss der Welt?", answer: "நைல் நதி / Nil", type: "text" },
  ]},
  { name: "தமிழ்நாடு", questions: [
    { value: 100, question: "தமிழ்நாட்டின் தலைநகரம் எது?\nWas ist die Hauptstadt von Tamil Nadu?", answer: "சென்னை / Chennai", type: "text" },
    { value: 200, question: "தமிழ்நாட்டின் மாநில விலங்கு எது?\nWas ist das Staatstier von Tamil Nadu?", answer: "நீலகிரி வரையாடு / Nilgiri Tahr", type: "text" },
    { value: 300, question: "தமிழ்நாட்டில் எத்தனை மாவட்டங்கள் உள்ளன?\nWie viele Distrikte hat Tamil Nadu?", answer: "38 மாவட்டங்கள் / 38 Distrikte", type: "text" },
    { value: 400, question: "தமிழ்நாட்டின் மிகப்பெரிய நகரம் எது?\nWelche ist die grösste Stadt in Tamil Nadu?", answer: "சென்னை / Chennai", type: "text" },
    { value: 500, question: "தமிழ்நாட்டின் பரப்பளவு எவ்வளவு சதுர கி.மீ?\nWie gross ist die Fläche von Tamil Nadu in km²?", answer: "130,058 சதுர கி.மீ / 130,058 km²", type: "text" },
  ]},
  { name: "விளையாட்டு & உலகம்", questions: [
    { value: 100, question: "கிரிக்கெட் உலகக் கோப்பையை அதிகமுறை வென்ற நாடு எது?\nWelches Land hat die meisten Cricket-Weltmeisterschaften gewonnen?", answer: "ஆஸ்திரேலியா / Australien", type: "text" },
    { value: 200, question: "ஒலிம்பிக் விளையாட்டுகள் எத்தனை ஆண்டுகளுக்கு ஒருமுறை நடைபெறும்?\nWie oft finden die Olympischen Spiele statt?", answer: "4 ஆண்டுகளுக்கு ஒருமுறை / Alle 4 Jahre", type: "text" },
    { value: 300, question: "FIFA உலகக் கோப்பை 2022 எந்த நாட்டில் நடந்தது?\nIn welchem Land fand die FIFA WM 2022 statt?", answer: "கத்தார் / Katar", type: "text" },
    { value: 400, question: "டென்னிஸில் கிராண்ட் ஸ்லாம் போட்டிகள் எத்தனை?\nWie viele Grand-Slam-Turniere gibt es im Tennis?", answer: "4 போட்டிகள் / 4 Turniere", type: "text" },
    { value: 500, question: "உலகின் வேகமான மனிதன் யார் (100 மீட்டர்)?\nWer ist der schnellste Mensch der Welt (100m)?", answer: "உசைன் போல்ட் / Usain Bolt", type: "text" },
  ]},
  { name: "யார்/என்ன இது?", questions: [
    { value: 100, question: "இது என்ன இடம்?\nWas ist das für ein Ort?", answer: "மீனாட்சி கோயில், மதுரை / Meenakshi Tempel, Madurai", type: "image", imageUrl: "/images/landmark1.jpg" },
    { value: 200, question: "இது என்ன இடம்?\nWas ist das für ein Ort?", answer: "மகாபலிபுரம் / Mahabalipuram", type: "image", imageUrl: "/images/landmark2.jpg" },
    { value: 300, question: "இது என்ன இடம்?\nWas ist das für ein Ort?", answer: "பிரகதீஸ்வரர் கோயில், தஞ்சாவூர் / Brihadeeswara Tempel, Thanjavur", type: "image", imageUrl: "/images/landmark3.jpg" },
    { value: 400, question: "இது என்ன இடம்?\nWas ist das für ein Ort?", answer: "ஊட்டி / Ooty", type: "image", imageUrl: "/images/landmark4.jpg" },
    { value: 500, question: "இது என்ன இடம்?\nWas ist das für ein Ort?", answer: "ராமேஸ்வரம் / Rameswaram", type: "image", imageUrl: "/images/landmark5.jpg" },
  ]},
  { name: "மதிப்பீடு", questions: [
    { value: 100, question: "உலகில் எத்தனை நாடுகள் உள்ளன?\nWie viele Länder gibt es auf der Welt?", answer: "195 நாடுகள் / 195 Länder", type: "estimate", timeLimit: 30 },
    { value: 200, question: "சந்திரனுக்கும் பூமிக்கும் இடையே உள்ள தூரம் எத்தனை கி.மீ?\nWie weit ist der Mond von der Erde entfernt (in km)?", answer: "384,400 கி.மீ / 384,400 km", type: "estimate", timeLimit: 30 },
    { value: 300, question: "இந்தியாவின் மக்கள் தொகை எவ்வளவு (பில்லியனில்)?\nWie hoch ist Indiens Bevölkerung (in Milliarden)?", answer: "1.4 பில்லியன் / 1.4 Milliarden", type: "estimate", timeLimit: 30 },
    { value: 400, question: "எவரெஸ்ட் சிகரத்தின் உயரம் எத்தனை மீட்டர்?\nWie hoch ist der Mount Everest in Metern?", answer: "8,849 மீட்டர் / 8,849 Meter", type: "estimate", timeLimit: 30 },
    { value: 500, question: "சுவிட்சர்லாந்தின் மக்கள் தொகை எவ்வளவு (மில்லியனில்)?\nWie hoch ist die Bevölkerung der Schweiz (in Millionen)?", answer: "8.7 மில்லியன் / 8.7 Millionen", type: "estimate", timeLimit: 30 },
  ]},
];

// ===============================
// Join Room
// ===============================
socket.emit("board-join-room", { roomCode: boardRoomCode, isCamMode: false });

// ===============================
// Build Board
// ===============================
function buildBoard() {
  if (!boardEl) return;
  boardEl.innerHTML = "";
  const cats = currentRound >= 2 ? categoriesRound2 : categoriesRound1;
  const multiplier = currentRound >= 2 ? 2 : 1;

  cats.forEach((cat) => {
    const header = document.createElement("div");
    header.className = "board-category";
    header.textContent = cat.name;
    boardEl.appendChild(header);
  });

  for (let qi = 0; qi < 5; qi++) {
    cats.forEach((cat, ci) => {
      const q = cat.questions[qi];
      const cell = document.createElement("button");
      cell.className = "board-cell";
      cell.textContent = q.value * multiplier;
      cell.dataset.categoryIndex = ci;
      cell.dataset.questionIndex = qi;
      const usedKey = `${ci}-${qi}`;
      if (usedCells.has(usedKey)) { cell.classList.add("board-cell-used"); cell.disabled = true; }
      cell.addEventListener("click", () => openQuestion(ci, qi, cell));
      boardEl.appendChild(cell);
    });
  }
}

// ===============================
// Render Teams Bar
// ===============================
function renderTeamsBar() {
  if (!teamsBar) return;
  const teamEntries = Object.entries(teams);
  if (teamEntries.length === 0) {
    teamsBar.innerHTML = '<div style="color:#64748b;padding:12px;">Noch keine Teams</div>';
    return;
  }
  teamsBar.innerHTML = teamEntries.map(([tid, team]) => {
    const isActive = activeTeamId === tid;
    const members = (team.members || []).map(pid => {
      const p = players[pid];
      if (!p) return null;
      const offlineClass = p.connected === false ? "offline" : "";
      return `<span class="team-member"><span class="member-dot ${offlineClass}"></span>${p.name}</span>`;
    }).filter(Boolean).join("");
    return `
      <div class="team-card team-${team.colorId || 'blue'} ${isActive ? 'team-active' : ''}" data-team-id="${tid}">
        <div class="team-card-header">
          <span class="team-color-dot"></span>
          <span class="team-card-name">${team.name}</span>
        </div>
        <div class="team-card-score">${team.score || 0} Punkte</div>
        <div class="team-card-members">${members || "—"}</div>
      </div>`;
  }).join("");

  // Aktiviere Start-Button sobald mindestens 1 Team mit Spielern da ist
  const hasPlayers = Object.values(teams).some(t => (t.members || []).length > 0);
  if (startGameBtn) startGameBtn.disabled = !hasPlayers || gameStarted;
}

// ===============================
// START GAME Animation
// ===============================
startGameBtn?.addEventListener("click", () => {
  const teamEntries = Object.entries(teams).filter(([, t]) => (t.members || []).length > 0);
  if (teamEntries.length === 0) return;

  gameStarted = true;
  if (startGameBtn) startGameBtn.style.display = "none";
  // Team-Reihenfolge für Rotation speichern
  teamOrder = teamEntries.map(([tid]) => tid);
  currentTeamIndex = 0;
  pickOverlay?.classList.add("visible");
  if (pickResult) { pickResult.style.display = "none"; pickResult.textContent = ""; }
  if (pickCloseBtn) pickCloseBtn.style.display = "none";
  if (pickSub) pickSub.textContent = "Zufällige Auswahl läuft...";

  const winner = teamEntries[Math.floor(Math.random() * teamEntries.length)];
  const [winTeamId, winTeam] = winner;
  const winColor = TEAM_COLORS_HEX[winTeam.colorId] || "#f9fafb";

  // Blink-Animation durch alle Teams
  let step = 0;
  const totalSteps = 20;
  const allTeams = teamEntries;

  function blink() {
    const current = allTeams[step % allTeams.length];
    const [, ct] = current;
    const color = TEAM_COLORS_HEX[ct.colorId] || "#f9fafb";
    if (pickName) {
      pickName.textContent = ct.name;
      pickName.style.color = color;
      pickName.style.textShadow = `0 0 30px ${color}`;
    }
    step++;
    const delay = step < totalSteps * 0.5 ? 80 : step < totalSteps * 0.8 ? 150 : 250;
    if (step < totalSteps) {
      setTimeout(blink, delay);
    } else {
      // Finales Ergebnis
      if (pickName) {
        pickName.textContent = winTeam.name;
        pickName.style.color = winColor;
        pickName.style.textShadow = `0 0 40px ${winColor}`;
      }
      if (pickSub) pickSub.textContent = "";
      if (pickResult) {
        pickResult.textContent = `🎉 ${winTeam.name} beginnt!`;
        pickResult.style.display = "block";
      }
      if (pickCloseBtn) pickCloseBtn.style.display = "inline-block";

      // Turn Indicator updaten
      activeTeamId = winTeamId;
      // Index in teamOrder setzen
      currentTeamIndex = teamOrder.indexOf(winTeamId);
      updateTurnIndicator();
    }
  }
  blink();
});

pickCloseBtn?.addEventListener("click", () => {
  pickOverlay?.classList.remove("visible");
});

// ===============================
// Turn Indicator
// ===============================
function updateTurnIndicator() {
  if (!gameStarted || teamOrder.length === 0) return;
  const tid = teamOrder[currentTeamIndex % teamOrder.length];
  const team = teams[tid];
  if (!team) return;
  activeTeamId = tid;
  const color = { red:'#f87171', blue:'#60a5fa', green:'#4ade80', purple:'#c084fc', orange:'#fb923c', pink:'#f472b6' }[team.colorId] || '#f9fafb';
  if (turnIndicatorEl) {
    // Nur den Text-Node aktualisieren, Button bleibt weg
    const span = document.createElement("span");
    span.style.color = color;
    span.style.fontWeight = "800";
    span.textContent = `${team.name} ist dran`;
    turnIndicatorEl.innerHTML = "";
    turnIndicatorEl.appendChild(span);
  }
  renderTeamsBar();
  socket.emit("board-turn-update", { roomCode: boardRoomCode, playerName: team.name, playerId: tid });
}

function advanceTeam() {
  if (!gameStarted || teamOrder.length === 0) return;
  currentTeamIndex = (currentTeamIndex + 1) % teamOrder.length;
  updateTurnIndicator();
}

// ===============================
// Open Question
// ===============================
function openQuestion(ci, qi, cell) {
  const cats = currentRound >= 2 ? categoriesRound2 : categoriesRound1;
  const multiplier = currentRound >= 2 ? 2 : 1;
  const q = cats[ci].questions[qi];
  currentQuestion = { ...q, categoryIndex: ci, questionIndex: qi, value: q.value * multiplier, cell };
  hasAwardedOnReveal = false;
  estimateAnswers = {};
  cell.classList.add("board-cell-active");
  if (questionPointsInnerEl) questionPointsInnerEl.textContent = currentQuestion.value;
  if (questionTextEl) questionTextEl.textContent = q.question || "";
  if (answerTextEl) { answerTextEl.textContent = ""; answerTextEl.classList.add("hidden"); }
  if (buzzInfoEl) { buzzInfoEl.textContent = ""; buzzInfoEl.classList.add("hidden"); }
  if (q.type === "image" && q.imageUrl && qMediaEl && qImageEl) {
    qImageEl.src = q.imageUrl; qMediaEl.classList.remove("hidden");
  } else { qMediaEl?.classList.add("hidden"); }
  if (estimateRevealContainer) estimateRevealContainer.classList.add("hidden");
  if (estimateRevealList) estimateRevealList.innerHTML = "";
  overlayEl?.classList.remove("hidden");
  socket.emit("board-question-opened", {
    roomCode: boardRoomCode, categoryIndex: ci, questionIndex: qi,
    question: q.question, answer: q.answer, value: currentQuestion.value,
    type: q.type, imageUrl: q.imageUrl || null, timeLimit: q.timeLimit || null,
  });
  if (q.type === "estimate") {
    socket.emit("board-estimate-start", { roomCode: boardRoomCode, question: q.question, timeLimit: q.timeLimit || 30 });
    startEstimateBoardTimer(q.timeLimit || 30);
  }
}

// ===============================
// Close Question
// ===============================
function closeQuestion() {
  if (boardRoomCode && currentQuestion) {
    socket.emit("board-question-closed", { roomCode: boardRoomCode, categoryIndex: currentQuestion.categoryIndex, questionIndex: currentQuestion.questionIndex });
  }
  overlayEl?.classList.add("hidden");
  closeLightbox();
  stopEstimateBoardTimer();
  if (currentQuestion?.cell) {
    currentQuestion.cell.classList.remove("board-cell-active");
    currentQuestion.cell.disabled = true;
    currentQuestion.cell.classList.add("board-cell-used");
    usedCells.add(`${currentQuestion.categoryIndex}-${currentQuestion.questionIndex}`);
  }
  if (currentQuestion?.type === "estimate" && boardRoomCode) socket.emit("board-estimate-end", { roomCode: boardRoomCode });
  lockedPlayersLocal.clear();
  if (boardRoomCode) socket.emit("board-clear-locks", { roomCode: boardRoomCode });
  activePlayerId = null; activePlayerName = null; activeTeamId = null; hasAwardedOnReveal = false;
  renderTeamsBar();
  if (buzzInfoEl) { buzzInfoEl.textContent = ""; buzzInfoEl.classList.add("hidden"); }
  currentQuestion = null;
  advanceTeam();
}
// ===============================
function openLightbox(src) { if (!lightboxEl || !lightboxImgEl) return; lightboxImgEl.src = src; lightboxEl.classList.remove("hidden"); }
function closeLightbox() { lightboxEl?.classList.add("hidden"); }
lightboxCloseEl?.addEventListener("click", closeLightbox);
lightboxEl?.addEventListener("click", (e) => { if (e.target === lightboxEl) closeLightbox(); });
qImageEl?.addEventListener("click", () => { if (qImageEl.src) openLightbox(qImageEl.src); });

// ===============================
// Screen Flash
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
// Estimate Timer
// ===============================
function startEstimateBoardTimer(sec) {
  stopEstimateBoardTimer();
  if (!estimateBoardTimerEl) return;
  estimateBoardTimerEl.classList.remove("hidden");
  let remaining = sec;
  const tick = () => {
    estimateBoardTimerEl.textContent = `⏱ ${remaining}`;
    if (remaining <= 0) { stopEstimateBoardTimer(); estimateBoardTimerEl.textContent = "⏱ Zeit!"; }
    remaining--;
  };
  tick();
  estimateBoardTimerInterval = setInterval(tick, 1000);
}

function stopEstimateBoardTimer() {
  if (estimateBoardTimerInterval) clearInterval(estimateBoardTimerInterval);
  estimateBoardTimerInterval = null;
  estimateBoardTimerEl?.classList.add("hidden");
}

// ===============================
// Button Handlers
// ===============================
showAnswerBtn?.addEventListener("click", () => {
  if (!currentQuestion) return;
  if (answerTextEl) { answerTextEl.textContent = currentQuestion.answer || ""; answerTextEl.classList.remove("hidden"); }
  socket.emit("board-answer-shown", { roomCode: boardRoomCode, answer: currentQuestion.answer });
  if (currentQuestion.type === "estimate" && Object.keys(estimateAnswers).length > 0) {
    renderEstimateReveal();
    socket.emit("board-estimate-reveal", { roomCode: boardRoomCode, answers: Object.values(estimateAnswers) });
  }
});

wrongBtn?.addEventListener("click", () => {
  if (!currentQuestion || !boardRoomCode || !activePlayerId) return;
  socket.emit("board-update-score", { roomCode: boardRoomCode, playerId: activePlayerId, delta: -currentQuestion.value });
  lockedPlayersLocal.add(activePlayerId);
  socket.emit("board-lock-player", { roomCode: boardRoomCode, playerId: activePlayerId });
  activePlayerId = null; activePlayerName = null; activeTeamId = null;
  renderTeamsBar();
  if (buzzInfoEl) { buzzInfoEl.textContent = ""; buzzInfoEl.classList.add("hidden"); }
  socket.emit("board-enable-buzz", { roomCode: boardRoomCode });
  closeLightbox(); safePlay(sfxWrong); flashScreen("wrong");
  socket.emit("board-wrong", { roomCode: boardRoomCode });
});

correctBtn?.addEventListener("click", () => {
  if (!currentQuestion || !boardRoomCode) return;
  if (!activePlayerId) { closeQuestion(); return; }
  socket.emit("board-update-score", { roomCode: boardRoomCode, playerId: activePlayerId, delta: currentQuestion.value });
  safePlay(sfxCorrect); flashScreen("correct");
  socket.emit("board-correct", { roomCode: boardRoomCode });
  hasAwardedOnReveal = true;
  closeQuestion();
});

closeQuestionBtn?.addEventListener("click", closeQuestion);

buzzResetBtn?.addEventListener("click", () => {
  if (!boardRoomCode) return;
  lockedPlayersLocal.clear();
  activePlayerId = null; activePlayerName = null; activeTeamId = null; hasAwardedOnReveal = false;
  renderTeamsBar();
  if (buzzInfoEl) { buzzInfoEl.textContent = ""; buzzInfoEl.classList.add("hidden"); }
  closeLightbox();
  socket.emit("board-enable-buzz", { roomCode: boardRoomCode });
});

// ===============================
// Estimate Reveal
// ===============================
function renderEstimateReveal() {
  if (!estimateRevealContainer || !estimateRevealList) return;
  const entries = Object.values(estimateAnswers);
  if (entries.length === 0) return;
  estimateRevealList.innerHTML = entries.map(a => {
    const val = a.noAnswer ? "—" : a.value;
    return `<div class="estimate-reveal-item"><span class="estimate-name">${a.name}</span><span class="estimate-value">${val}</span></div>`;
  }).join("");
  estimateRevealContainer.classList.remove("hidden");
}

// ===============================
// Socket Events
// ===============================
socket.on("teams-updated", (serverTeams) => {
  teams = serverTeams || {};
  renderTeamsBar();
});

socket.on("players-updated", (serverPlayers) => {
  players = serverPlayers || {};
  renderTeamsBar();
});

socket.on("player-buzzed-first", ({ playerId, name, teamId, teamName }) => {
  activePlayerId = playerId; activePlayerName = name; activeTeamId = teamId;
  renderTeamsBar(); safePlay(sfxBuzz);
  if (buzzInfoEl) { buzzInfoEl.textContent = `${name} (${teamName || "Team"}) hat gebuzzert!`; buzzInfoEl.classList.remove("hidden"); }
});

socket.on("buzzing-status", ({ enabled }) => {
  if (enabled) {
    activePlayerId = null; activePlayerName = null; activeTeamId = null;
    renderTeamsBar();
    if (buzzInfoEl) { buzzInfoEl.textContent = ""; buzzInfoEl.classList.add("hidden"); }
  }
});

socket.on("estimate-answer-received-board", ({ playerId, name, value, noAnswer }) => {
  estimateAnswers[playerId] = { name, value, noAnswer };
});

socket.on("game-ended", () => {
  alert("Das Spiel wurde beendet.");
  window.location.href = "/jeopardy-teams.html";
});

// ===============================
// Keyboard Shortcuts
// ===============================
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") { e.preventDefault(); closeQuestion(); return; }
  if (e.key === " " && !overlayEl?.classList.contains("hidden")) { e.preventDefault(); showAnswerBtn?.click(); }
});

// ===============================
// Init
// ===============================
buildBoard();
