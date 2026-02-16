// public/spectator-teams.js
// Online Spieler für Jeopardy Teams Modus (ohne Kamera)

const socket = io();

// ================================
// DOM Elements
// ================================
const joinOverlay = document.getElementById("joinOverlay");
const roomCodeInput = document.getElementById("roomCodeInput");
const playerNameInput = document.getElementById("playerName");
const teamSelection = document.getElementById("teamSelection");
const joinBtn = document.getElementById("joinBtn");
const errorMsg = document.getElementById("errorMsg");
const spectatorBuzzBtn = document.getElementById("spectatorBuzzBtn");
const boardEl = document.getElementById("board");
const teamsBar = document.getElementById("teamsBar");
const turnIndicatorEl = document.getElementById("turnIndicator");
const overlayEl = document.getElementById("questionOverlay");
const questionPointsInnerEl = document.querySelector("#questionPoints .points-inner");
const questionTextEl = document.getElementById("questionText");
const answerTextEl = document.getElementById("answerText");
const qMediaEl = document.getElementById("qMedia");
const qImageEl = document.getElementById("qImage");
const lightboxEl = document.getElementById("lightbox");
const lightboxImgEl = document.getElementById("lightboxImg");
const lightboxCloseEl = document.getElementById("lightboxClose");
const estimateModal = document.getElementById("estimateModal");
const estimateTimer = document.getElementById("estimateTimer");
const estimateInput = document.getElementById("estimateInput");
const estimateSubmit = document.getElementById("estimateSubmit");
const estimateRevealContainer = document.getElementById("estimateRevealContainer");
const estimateRevealList = document.getElementById("estimateRevealList");

// ================================
// State
// ================================
let roomCode = null;
let teams = {};
let players = {};
let selectedTeamId = null;
let myPlayerId = null;
let myTeamId = null;
let buzzingEnabled = false;
let currentRound = 1;
let usedCells = new Set();
let estimateTimerInterval = null;
let estimateLocked = false;
let activeTeamId = null;

// ================================
// Categories
// ================================
const categoriesRound1 = [
  { name: "தமிழ் சினிமா", questions: [{value:100},{value:200},{value:300},{value:400},{value:500}] },
  { name: "தமிழ் பண்பாடு", questions: [{value:100},{value:200},{value:300},{value:400},{value:500}] },
  { name: "தமிழ் உணவு", questions: [{value:100},{value:200},{value:300},{value:400},{value:500}] },
  { name: "யார் இது?", questions: [{value:100},{value:200},{value:300},{value:400},{value:500}] },
  { name: "மதிப்பீடு", questions: [{value:100},{value:200},{value:300},{value:400},{value:500}] },
];

const categoriesRound2 = [
  { name: "பொது அறிவு", questions: [{value:100},{value:200},{value:300},{value:400},{value:500}] },
  { name: "தமிழ்நாடு", questions: [{value:100},{value:200},{value:300},{value:400},{value:500}] },
  { name: "விளையாட்டு & உலகம்", questions: [{value:100},{value:200},{value:300},{value:400},{value:500}] },
  { name: "யார்/என்ன இது?", questions: [{value:100},{value:200},{value:300},{value:400},{value:500}] },
  { name: "மதிப்பீடு", questions: [{value:100},{value:200},{value:300},{value:400},{value:500}] },
];

// ================================
// Build Board
// ================================
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
      const cell = document.createElement("div");
      cell.className = "board-cell";
      cell.textContent = q.value * multiplier;
      cell.dataset.categoryIndex = ci;
      cell.dataset.questionIndex = qi;

      const usedKey = `${ci}-${qi}`;
      if (usedCells.has(usedKey)) {
        cell.classList.add("board-cell-used");
      }

      boardEl.appendChild(cell);
    });
  }
}

// ================================
// Render Team Selection (Join)
// ================================
function renderTeamSelection() {
  if (!teamSelection) return;

  const teamEntries = Object.entries(teams);

  if (teamEntries.length === 0) {
    teamSelection.innerHTML = '<div class="no-teams-msg">Keine Teams verfügbar</div>';
    return;
  }

  teamSelection.innerHTML = teamEntries.map(([tid, team]) => {
    const selected = selectedTeamId === tid ? "selected" : "";
    const memberCount = (team.members || []).length;

    return `
      <div class="team-option team-${team.colorId || 'blue'} ${selected}" data-team-id="${tid}">
        <div class="team-option-name">${team.name}</div>
        <div class="team-option-count">${memberCount} Spieler</div>
      </div>
    `;
  }).join("");

  teamSelection.querySelectorAll(".team-option").forEach(option => {
    option.addEventListener("click", () => {
      selectedTeamId = option.dataset.teamId;
      renderTeamSelection();
      checkJoinReady();
    });
  });
}

// ================================
// Render Teams Bar (Game)
// ================================
function renderTeamsBar() {
  if (!teamsBar) return;

  const teamEntries = Object.entries(teams);

  if (teamEntries.length === 0) {
    teamsBar.innerHTML = '<div style="color:#64748b;padding:12px;">Noch keine Teams</div>';
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
      <div class="team-card team-${team.colorId || 'blue'} ${activeClass}" data-team-id="${tid}">
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

// ================================
// Check Join Ready
// ================================
function checkJoinReady() {
  const code = roomCodeInput?.value?.trim();
  const name = playerNameInput?.value?.trim();
  joinBtn.disabled = !code || code.length < 5 || !name || !selectedTeamId;
}

roomCodeInput?.addEventListener("input", () => {
  roomCodeInput.value = roomCodeInput.value.toUpperCase();
  
  const code = roomCodeInput.value.trim();
  if (code.length === 5) {
    socket.emit("request-teams", { roomCode: code });
  } else {
    teams = {};
    renderTeamSelection();
  }
  
  checkJoinReady();
});

playerNameInput?.addEventListener("input", checkJoinReady);

// ================================
// Join Game
// ================================
joinBtn?.addEventListener("click", joinGame);
playerNameInput?.addEventListener("keydown", (e) => {
  if (e.key === "Enter" && !joinBtn.disabled) joinGame();
});

function joinGame() {
  const code = roomCodeInput?.value?.trim().toUpperCase();
  const name = playerNameInput?.value?.trim();

  if (!code || !name || !selectedTeamId) return;

  roomCode = code;

  socket.emit("player-join-teams", { roomCode, name, teamId: selectedTeamId, hasCamera: false }, (response) => {
    if (response?.success) {
      myPlayerId = response.playerId;
      myTeamId = response.teamId;

      socket.emit("spectator-join-room", { roomCode, hasCamera: false });

      joinOverlay?.classList.add("hidden");
      buildBoard();
    } else {
      errorMsg.textContent = response?.error || "Fehler beim Beitreten";
    }
  });
}

// ================================
// Buzzer
// ================================
spectatorBuzzBtn?.addEventListener("click", buzz);

document.addEventListener("keydown", (e) => {
  if (e.key === " " && joinOverlay?.classList.contains("hidden") && !estimateModal?.classList.contains("hidden") === false) {
    e.preventDefault();
    buzz();
  }
});

function buzz() {
  if (!buzzingEnabled || !roomCode) return;
  socket.emit("player-buzz", { roomCode });
}

// ================================
// Lightbox
// ================================
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

// ================================
// Screen Flash
// ================================
function flashScreen(type) {
  const flash = document.getElementById("screenFlash");
  if (!flash) return;
  flash.classList.remove("flash-correct", "flash-wrong");
  void flash.offsetWidth;
  flash.classList.add(type === "correct" ? "flash-correct" : "flash-wrong");
  setTimeout(() => flash.classList.remove("flash-correct", "flash-wrong"), 400);
}

// ================================
// Estimate
// ================================
function startEstimateTimer(sec) {
  stopEstimateTimer();
  estimateLocked = false;
  estimateInput.disabled = false;
  estimateSubmit.disabled = false;

  let remaining = sec;
  const tick = () => {
    if (estimateTimer) estimateTimer.textContent = remaining;
    if (remaining <= 0) {
      stopEstimateTimer();
      submitEstimate(true);
    }
    remaining--;
  };
  tick();
  estimateTimerInterval = setInterval(tick, 1000);
}

function stopEstimateTimer() {
  if (estimateTimerInterval) clearInterval(estimateTimerInterval);
  estimateTimerInterval = null;
}

function submitEstimate(timeout = false) {
  if (estimateLocked) return;
  estimateLocked = true;
  estimateInput.disabled = true;
  estimateSubmit.disabled = true;

  const val = estimateInput?.value?.trim();
  socket.emit("estimate-answer", {
    roomCode,
    value: val || null,
    noAnswer: !val || timeout,
  });

  estimateModal?.classList.add("hidden");
  stopEstimateTimer();
}

estimateSubmit?.addEventListener("click", () => submitEstimate(false));
estimateInput?.addEventListener("keydown", (e) => {
  if (e.key === "Enter") submitEstimate(false);
});

// ================================
// Socket Events
// ================================
socket.on("teams-updated", (serverTeams) => {
  teams = serverTeams || {};
  renderTeamSelection();
  renderTeamsBar();
});

socket.on("players-updated", (serverPlayers) => {
  players = serverPlayers || {};
  renderTeamsBar();
});

socket.on("buzzing-status", ({ enabled }) => {
  buzzingEnabled = enabled;
  spectatorBuzzBtn.disabled = !enabled;

  if (enabled) {
    spectatorBuzzBtn.classList.add("free");
    spectatorBuzzBtn.classList.remove("pressed");
  } else {
    spectatorBuzzBtn.classList.remove("free");
  }
});

socket.on("player-buzzed-first", ({ playerId, name, teamId, teamName }) => {
  buzzingEnabled = false;
  spectatorBuzzBtn.disabled = true;
  spectatorBuzzBtn.classList.remove("free");

  activeTeamId = teamId;
  renderTeamsBar();

  if (playerId === myPlayerId) {
    spectatorBuzzBtn.classList.add("pressed");
  }
});

socket.on("you-are-locked", () => {
  spectatorBuzzBtn.disabled = true;
  spectatorBuzzBtn.classList.remove("free");
});

socket.on("spectator-question-opened", ({ categoryIndex, questionIndex, question, value, type, imageUrl }) => {
  if (questionPointsInnerEl) questionPointsInnerEl.textContent = value;
  if (questionTextEl) questionTextEl.textContent = question || "";

  if (type === "image" && imageUrl && qMediaEl && qImageEl) {
    qImageEl.src = imageUrl;
    qMediaEl.classList.remove("hidden");
  } else {
    qMediaEl?.classList.add("hidden");
  }

  answerTextEl?.classList.add("hidden");
  estimateRevealContainer?.classList.add("hidden");
  overlayEl?.classList.remove("hidden");
});

socket.on("spectator-answer-shown", ({ answer }) => {
  if (answerTextEl) {
    answerTextEl.textContent = answer || "";
    answerTextEl.classList.remove("hidden");
  }
});

socket.on("spectator-question-closed", ({ categoryIndex, questionIndex }) => {
  overlayEl?.classList.add("hidden");
  closeLightbox();
  usedCells.add(`${categoryIndex}-${questionIndex}`);
  activeTeamId = null;
  renderTeamsBar();
  buildBoard();
});

socket.on("spectator-correct", () => {
  flashScreen("correct");
});

socket.on("spectator-wrong", () => {
  flashScreen("wrong");
});

socket.on("spectator-round-changed", ({ round }) => {
  currentRound = round;
  usedCells.clear();
  buildBoard();
});

socket.on("estimate-question-started", ({ question, timeLimit }) => {
  estimateInput.value = "";
  estimateModal?.classList.remove("hidden");
  startEstimateTimer(timeLimit || 30);
});

socket.on("estimate-locked", () => {
  estimateLocked = true;
  estimateInput.disabled = true;
  estimateSubmit.disabled = true;
  estimateModal?.classList.add("hidden");
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

socket.on("game-ended", () => {
  alert("Das Spiel wurde beendet.");
  window.location.href = "/jeopardy-teams.html";
});

// ================================
// Init
// ================================
buildBoard();
