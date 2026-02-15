// public/spectator-teams.js
// Spectator-Client für Jeopardy Teams Modus (ohne Kamera)

const socket = io();

// ===============================
// DOM Elements
// ===============================

// Join UI
const joinOverlay = document.getElementById("spectatorJoinOverlay");
const roomCodeInput = document.getElementById("spectatorRoomCode");
const nameInput = document.getElementById("spectatorName");
const teamSelectGrid = document.getElementById("teamSelectGrid");
const joinBtn = document.getElementById("spectatorJoinBtn");
const joinStatus = document.getElementById("spectatorJoinStatus");

// Main Page
const mainPage = document.getElementById("spectatorMainPage");
const teamsBar = document.getElementById("teamsBar");
const buzzerBtn = document.getElementById("spectatorBuzzBtn");

// Board UI
const boardEl = document.getElementById("board");
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

// Estimate
const estimateRevealContainer = document.getElementById("estimateRevealContainer");
const estimateRevealList = document.getElementById("estimateRevealList");
const estimateModal = document.getElementById("estimateModal");
const estimateQuestionTextEl = document.getElementById("estimateQuestionText");
const estimateInput = document.getElementById("estimateInput");
const estimateTimerEl = document.getElementById("estimateTimer");
const estimateStatusEl = document.getElementById("estimateStatus");
const sendEstimateBtn = document.getElementById("sendEstimateBtn");

// ===============================
// Audio
// ===============================
const sfxBuzz = new Audio("/sounds/buzzer-button.wav");
const sfxCorrect = new Audio("/sounds/correct-sound.wav");
const sfxWrong = new Audio("/sounds/wrong-sound.wav");
[sfxBuzz, sfxCorrect, sfxWrong].forEach(s => s.preload = "auto");

function safePlay(sound) {
  sound.currentTime = 0;
  sound.play().catch(() => {});
}

// ===============================
// State
// ===============================
let currentRoomCode = null;
let currentName = null;
let currentTeamId = null;
let selectedTeamId = null;
let playerId = null;
let joined = false;
let buzzingEnabled = false;
let isLocked = false;

// Data
let teams = {};
let players = {};
let activePlayerId = null;
let activePlayerName = null;
let activeTeamId = null;
let currentRound = 1;
let usedCells = new Set();

// Estimate
let estimateActive = false;
let estimateLocked = false;
let estimateDeadline = null;
let estimateTimerInterval = null;

// ===============================
// Categories (same as board)
// ===============================
const categoriesRound1 = [
  { name: "தமிழ் சினிமா", questions: [100,200,300,400,500].map(v => ({value:v})) },
  { name: "தமிழ் பண்பாடு", questions: [100,200,300,400,500].map(v => ({value:v})) },
  { name: "தமிழ் உணவு", questions: [100,200,300,400,500].map(v => ({value:v})) },
  { name: "யார் இது?", questions: [100,200,300,400,500].map(v => ({value:v})) },
  { name: "மதிப்பீடு", questions: [100,200,300,400,500].map(v => ({value:v})) },
];

const categoriesRound2 = [
  { name: "பொது அறிவு", questions: [100,200,300,400,500].map(v => ({value:v})) },
  { name: "தமிழ்நாடு", questions: [100,200,300,400,500].map(v => ({value:v})) },
  { name: "விளையாட்டு & உலகம்", questions: [100,200,300,400,500].map(v => ({value:v})) },
  { name: "யார்/என்ன இது?", questions: [100,200,300,400,500].map(v => ({value:v})) },
  { name: "மதிப்பீடு", questions: [100,200,300,400,500].map(v => ({value:v})) },
];

// ===============================
// Team Selection UI
// ===============================
function renderTeamSelection() {
  if (!teamSelectGrid) return;

  const teamEntries = Object.entries(teams);

  if (teamEntries.length === 0) {
    teamSelectGrid.innerHTML = '<div class="no-teams-msg">Code eingeben um Teams zu laden...</div>';
    updateJoinButton();
    return;
  }

  teamSelectGrid.innerHTML = teamEntries.map(([tid, team]) => {
    const memberCount = (team.members || []).length;
    const selectedClass = selectedTeamId === tid ? "selected" : "";
    return `
      <button type="button" class="team-select-btn team-${team.colorId || 'blue'} ${selectedClass}" data-team-id="${tid}">
        <span class="team-select-name">${team.name}</span>
        <span class="team-select-count">${memberCount} Spieler</span>
      </button>
    `;
  }).join("");

  // Add click handlers
  teamSelectGrid.querySelectorAll(".team-select-btn").forEach(btn => {
    btn.addEventListener("click", (e) => {
      e.preventDefault();
      selectedTeamId = btn.dataset.teamId;
      renderTeamSelection();
      updateJoinButton();
    });
  });
}

function updateJoinButton() {
  if (!joinBtn) return;
  const hasCode = roomCodeInput?.value?.trim().length >= 3;
  const hasName = nameInput?.value?.trim().length > 0;
  const hasTeam = selectedTeamId !== null;
  joinBtn.disabled = !(hasCode && hasName && hasTeam);
}

// ===============================
// Build Board
// ===============================
function buildBoard() {
  if (!boardEl) return;
  boardEl.innerHTML = "";

  const cats = currentRound >= 2 ? categoriesRound2 : categoriesRound1;
  const multiplier = currentRound >= 2 ? 2 : 1;

  cats.forEach((cat, ci) => {
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
      cell.disabled = true;

      const usedKey = `${ci}-${qi}`;
      if (usedCells.has(usedKey)) {
        cell.classList.add("board-cell-used");
      }

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
    teamsBar.innerHTML = "";
    return;
  }

  teamsBar.innerHTML = teamEntries.map(([tid, team]) => {
    const isActive = activeTeamId === tid;
    const activeClass = isActive ? "team-active" : "";

    const members = (team.members || [])
      .map(pid => {
        const p = players[pid];
        if (!p) return null;
        const offlineClass = p.connected === false ? "offline" : "";
        return `<span class="team-member"><span class="member-dot ${offlineClass}"></span>${p.name}</span>`;
      })
      .filter(Boolean)
      .join("");

    return `
      <div class="team-card team-${team.colorId || 'blue'} ${activeClass}">
        <div class="team-card-header">
          <span class="team-color-dot"></span>
          <span class="team-card-name">${team.name}</span>
        </div>
        <div class="team-card-score">${team.score || 0} Punkte</div>
        <div class="team-card-members">${members || "—"}</div>
      </div>
    `;
  }).join("");
}

// ===============================
// Buzzer
// ===============================
function updateBuzzerIndicator() {
  if (!buzzerBtn) return;

  if (!joined) {
    buzzerBtn.classList.add("hidden");
    return;
  }

  buzzerBtn.classList.remove("hidden");

  if (isLocked) {
    buzzerBtn.classList.add("buzzer-locked");
    buzzerBtn.classList.remove("buzzer-active");
    buzzerBtn.innerHTML = "BUZZER<br>GESPERRT";
    buzzerBtn.disabled = true;
    return;
  }

  if (buzzingEnabled) {
    buzzerBtn.classList.remove("buzzer-locked");
    buzzerBtn.classList.add("buzzer-active");
    buzzerBtn.innerHTML = "BUZZER<br>FREI";
    buzzerBtn.disabled = false;
  } else {
    buzzerBtn.classList.add("buzzer-locked");
    buzzerBtn.classList.remove("buzzer-active");
    buzzerBtn.innerHTML = "BUZZER<br>GESPERRT";
    buzzerBtn.disabled = true;
  }
}

function doBuzz() {
  if (!joined || !currentRoomCode || !buzzingEnabled || isLocked) return;

  if (buzzerBtn) {
    buzzerBtn.classList.add("buzzer-pressed");
    setTimeout(() => buzzerBtn.classList.remove("buzzer-pressed"), 150);
  }

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
  e.preventDefault();
  doBuzz();
});

// ===============================
// Lightbox
// ===============================
function openLightbox(src) {
  if (!lightboxEl || !lightboxImgEl) return;
  lightboxImgEl.src = src;
  lightboxEl.classList.remove("hidden");
}

function closeLightbox() {
  lightboxEl?.classList.add("hidden");
}

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
// Join Logic
// ===============================
roomCodeInput?.addEventListener("input", () => {
  updateJoinButton();
  // Fetch teams when code is entered
  const code = roomCodeInput.value?.trim().toUpperCase();
  if (code.length >= 3) {
    socket.emit("request-teams", { roomCode: code });
  }
});

nameInput?.addEventListener("input", updateJoinButton);

joinBtn?.addEventListener("click", () => {
  const rc = roomCodeInput?.value?.trim().toUpperCase();
  const nm = nameInput?.value?.trim();

  if (!rc || !nm || !selectedTeamId) return;

  currentRoomCode = rc;
  currentName = nm;
  currentTeamId = selectedTeamId;

  if (joinStatus) {
    joinStatus.textContent = "Verbinde...";
    joinStatus.className = "spectator-join-status";
  }

  socket.emit("player-join-teams", { roomCode: rc, name: nm, teamId: selectedTeamId }, (res) => {
    if (res?.success) {
      playerId = res.playerId;
      joined = true;

      joinOverlay?.classList.add("hidden");
      mainPage?.classList.remove("hidden");
      teamsBar?.classList.remove("hidden");

      buildBoard();
      renderTeamsBar();
      updateBuzzerIndicator();

      socket.emit("spectator-join-room", { roomCode: rc });
    } else {
      if (joinStatus) {
        joinStatus.textContent = res?.error || "Fehler beim Beitreten";
        joinStatus.className = "spectator-join-status error";
      }
    }
  });
});

// ===============================
// Socket Events - Teams
// ===============================
socket.on("teams-updated", (serverTeams) => {
  teams = serverTeams || {};
  if (!joined) {
    renderTeamSelection();
  } else {
    renderTeamsBar();
  }
});

socket.on("players-updated", (serverPlayers) => {
  players = serverPlayers || {};
  renderTeamsBar();
});

// ===============================
// Socket Events - Buzzer
// ===============================
socket.on("buzzing-status", ({ enabled }) => {
  buzzingEnabled = !!enabled;

  if (enabled) {
    activePlayerId = null;
    activePlayerName = null;
    activeTeamId = null;
    renderTeamsBar();
    if (buzzInfoEl) {
      buzzInfoEl.textContent = "";
      buzzInfoEl.classList.add("hidden");
    }
    if (questionCardEl) questionCardEl.classList.remove("question-card-buzzed");
  }

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

socket.on("player-buzzed-first", (payload) => {
  activePlayerId = payload?.playerId;
  activePlayerName = payload?.name;
  activeTeamId = payload?.teamId;

  renderTeamsBar();
  safePlay(sfxBuzz);

  if (buzzInfoEl && activePlayerName) {
    const teamName = teams[activeTeamId]?.name || "";
    buzzInfoEl.textContent = `${activePlayerName} (${teamName}) hat gebuzzert!`;
    buzzInfoEl.classList.remove("hidden");
  }
  if (questionCardEl) questionCardEl.classList.add("question-card-buzzed");
});

// ===============================
// Socket Events - Board Sync
// ===============================
socket.on("spectator-question-opened", (data) => {
  const { categoryIndex, questionIndex, question, value, type, imageUrl, timeLimit } = data;

  if (questionPointsInnerEl) questionPointsInnerEl.textContent = value || "";
  if (questionTextEl) questionTextEl.textContent = question || "";
  if (answerTextEl) { answerTextEl.textContent = ""; answerTextEl.classList.add("hidden"); }

  if (type === "image" && imageUrl && qMediaEl && qImageEl) {
    qImageEl.src = imageUrl;
    qMediaEl.classList.remove("hidden");
  } else {
    qMediaEl?.classList.add("hidden");
  }

  const cell = boardEl?.querySelector(`[data-category-index="${categoryIndex}"][data-question-index="${questionIndex}"]`);
  if (cell) cell.classList.add("board-cell-active");

  overlayEl?.classList.remove("hidden");

  if (buzzInfoEl) { buzzInfoEl.textContent = ""; buzzInfoEl.classList.add("hidden"); }
  if (questionCardEl) questionCardEl.classList.remove("question-card-buzzed");
});

socket.on("spectator-answer-shown", ({ answer }) => {
  if (answerTextEl) {
    answerTextEl.textContent = answer || "";
    answerTextEl.classList.remove("hidden");
  }
  closeLightbox();
});

socket.on("spectator-question-closed", ({ categoryIndex, questionIndex }) => {
  usedCells.add(`${categoryIndex}-${questionIndex}`);

  const cell = boardEl?.querySelector(`[data-category-index="${categoryIndex}"][data-question-index="${questionIndex}"]`);
  if (cell) {
    cell.classList.remove("board-cell-active");
    cell.classList.add("board-cell-used");
  }

  overlayEl?.classList.add("hidden");

  activePlayerId = null;
  activePlayerName = null;
  activeTeamId = null;
  renderTeamsBar();

  if (buzzInfoEl) { buzzInfoEl.textContent = ""; buzzInfoEl.classList.add("hidden"); }
  if (questionCardEl) questionCardEl.classList.remove("question-card-buzzed");
  closeLightbox();
  qMediaEl?.classList.add("hidden");
});

socket.on("spectator-correct", () => {
  safePlay(sfxCorrect);
  flashScreen("correct");
  setTimeout(() => {
    activePlayerId = null;
    activePlayerName = null;
    activeTeamId = null;
    renderTeamsBar();
    if (buzzInfoEl) buzzInfoEl.classList.add("hidden");
    if (questionCardEl) questionCardEl.classList.remove("question-card-buzzed");
  }, 1500);
});

socket.on("spectator-wrong", () => {
  safePlay(sfxWrong);
  flashScreen("wrong");
  setTimeout(() => {
    activePlayerId = null;
    activePlayerName = null;
    activeTeamId = null;
    renderTeamsBar();
    if (buzzInfoEl) buzzInfoEl.classList.add("hidden");
    if (questionCardEl) questionCardEl.classList.remove("question-card-buzzed");
  }, 1000);
});

socket.on("spectator-round-changed", ({ round }) => {
  currentRound = round;
  usedCells.clear();
  buildBoard();
});

socket.on("spectator-turn-update", ({ playerName, playerId: turnPlayerId }) => {
  if (turnIndicatorEl && playerName) {
    turnIndicatorEl.textContent = `⭐ ${playerName} ist dran ⭐`;
  }
});

// ===============================
// Estimate Events
// ===============================
socket.on("estimate-question-started", ({ question, timeLimit }) => {
  if (!joined) return;
  estimateActive = true;
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
});

socket.on("spectator-estimate-reveal", ({ answers }) => {
  if (!estimateRevealContainer || !estimateRevealList) return;
  estimateRevealList.innerHTML = (answers || []).map(a => {
    const val = a.noAnswer ? "—" : a.value;
    return `<div class="estimate-reveal-item"><span class="estimate-name">${a.name}</span><span class="estimate-value">${val}</span></div>`;
  }).join("");
  estimateRevealContainer.classList.remove("hidden");
});

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
// Connection
// ===============================
socket.on("connect", () => {
  console.log("Verbunden mit Server");
});

socket.on("disconnect", () => {
  console.log("Verbindung verloren");
});

socket.on("game-ended", () => {
  alert("Das Spiel wurde beendet.");
  window.location.href = "/jeopardy-teams.html";
});
