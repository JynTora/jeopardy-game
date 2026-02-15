// public/player-teams.js
// Local Buzzer für Jeopardy Teams Modus

const socket = io();

// ===============================
// DOM Elements
// ===============================
const joinOverlay = document.getElementById("joinOverlay");
const playerNameInput = document.getElementById("playerNameInput");
const teamSelectGrid = document.getElementById("teamSelectGrid");
const newTeamInput = document.getElementById("newTeamInput");
const newTeamBtn = document.getElementById("newTeamBtn");
const joinBtn = document.getElementById("joinBtn");
const joinError = document.getElementById("joinError");

const buzzerHeader = document.getElementById("buzzerHeader");
const buzzerMain = document.getElementById("buzzerMain");
const statusBar = document.getElementById("statusBar");
const teamBadge = document.getElementById("teamBadge");
const playerNameDisplay = document.getElementById("playerNameDisplay");
const leaveBtn = document.getElementById("leaveBtn");
const buzzerButton = document.getElementById("buzzerButton");
const statusText = document.getElementById("statusText");

// ===============================
// Audio
// ===============================
const sfxBuzz = new Audio("/sounds/buzzer-button.wav");
sfxBuzz.preload = "auto";

// ===============================
// State
// ===============================
let joined = false;
let currentTeamId = null;
let selectedTeamId = null;
let playerName = "";
let playerId = null;
let buzzingEnabled = false;
let isLocked = false;
let teams = {};

// Team Farben
const TEAM_COLORS = ["red", "blue", "green", "purple", "orange", "pink"];
let colorIndex = 0;

// ===============================
// Team Selection UI
// ===============================
function renderTeamSelection() {
  if (!teamSelectGrid) return;

  const teamEntries = Object.entries(teams);

  if (teamEntries.length === 0) {
    teamSelectGrid.innerHTML = '<div class="no-teams-msg">Warte auf Teams vom Host...</div>';
    return;
  }

  teamSelectGrid.innerHTML = teamEntries.map(([tid, team]) => {
    const memberCount = (team.members || []).length;
    const selectedClass = selectedTeamId === tid ? "selected" : "";
    return `
      <button class="team-select-btn team-${team.colorId || 'blue'} ${selectedClass}" data-team-id="${tid}">
        <span class="team-select-name">${team.name}</span>
        <span class="team-select-count">${memberCount} Spieler</span>
      </button>
    `;
  }).join("");

  // Add click handlers
  teamSelectGrid.querySelectorAll(".team-select-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      selectedTeamId = btn.dataset.teamId;
      renderTeamSelection();
      updateJoinButton();
    });
  });
}

function updateJoinButton() {
  if (!joinBtn) return;
  const hasName = playerNameInput?.value?.trim().length > 0;
  const hasTeam = selectedTeamId !== null;
  joinBtn.disabled = !(hasName && hasTeam);
}

// ===============================
// Event Listeners - Join
// ===============================
playerNameInput?.addEventListener("input", updateJoinButton);

newTeamBtn?.addEventListener("click", () => {
  const name = newTeamInput?.value?.trim();
  if (!name) return;

  const colorId = TEAM_COLORS[colorIndex % TEAM_COLORS.length];
  colorIndex++;

  // Emit to create team (auch ohne roomCode für lokalen Modus)
  socket.emit("teams-create-team-local", { name, colorId });
  if (newTeamInput) newTeamInput.value = "";
});

newTeamInput?.addEventListener("keydown", (e) => {
  if (e.key === "Enter") newTeamBtn?.click();
});

joinBtn?.addEventListener("click", () => {
  const name = playerNameInput?.value?.trim();
  if (!name || !selectedTeamId) return;

  playerName = name;
  currentTeamId = selectedTeamId;

  socket.emit("player-join-teams-local", { name, teamId: currentTeamId }, (res) => {
    if (res?.success) {
      playerId = res.playerId;
      joined = true;
      showBuzzerUI();
    } else {
      if (joinError) joinError.textContent = res?.error || "Fehler beim Beitreten";
    }
  });
});

// ===============================
// Show Buzzer UI
// ===============================
function showBuzzerUI() {
  joinOverlay?.classList.add("hidden");
  buzzerHeader?.classList.remove("hidden");
  buzzerMain?.classList.remove("hidden");
  statusBar?.classList.remove("hidden");

  const team = teams[currentTeamId];
  if (teamBadge && team) {
    teamBadge.textContent = team.name;
    teamBadge.className = `team-badge team-${team.colorId || 'blue'}`;
  }

  if (playerNameDisplay) {
    playerNameDisplay.textContent = playerName;
  }

  updateBuzzerState();
}

// ===============================
// Buzzer State
// ===============================
function updateBuzzerState() {
  if (!buzzerButton) return;

  if (isLocked) {
    buzzerButton.className = "buzzer-button buzzer-locked";
    buzzerButton.disabled = true;
    buzzerButton.innerHTML = `
      <span class="buzzer-text">GESPERRT</span>
      <span class="buzzer-subtext">Du bist ausgesperrt</span>
    `;
    return;
  }

  if (buzzingEnabled) {
    buzzerButton.className = "buzzer-button buzzer-free";
    buzzerButton.disabled = false;
    buzzerButton.innerHTML = `
      <span class="buzzer-text">BUZZ!</span>
      <span class="buzzer-subtext">Drücken zum Buzzern</span>
    `;
  } else {
    buzzerButton.className = "buzzer-button buzzer-locked";
    buzzerButton.disabled = true;
    buzzerButton.innerHTML = `
      <span class="buzzer-text">WARTEN</span>
      <span class="buzzer-subtext">Buzzer gesperrt</span>
    `;
  }
}

// ===============================
// Buzzer Action
// ===============================
function doBuzz() {
  if (!joined || !buzzingEnabled || isLocked) return;

  // Visual feedback
  buzzerButton?.classList.add("buzzer-pressed");
  setTimeout(() => buzzerButton?.classList.remove("buzzer-pressed"), 200);

  // Sound
  sfxBuzz.currentTime = 0;
  sfxBuzz.play().catch(() => {});

  socket.emit("player-buzz-teams-local", { teamId: currentTeamId });

  buzzingEnabled = false;
  updateBuzzerState();
}

buzzerButton?.addEventListener("click", doBuzz);

// Keyboard (Space)
document.addEventListener("keydown", (e) => {
  if (e.code !== "Space") return;
  if (!joined) return;

  const t = e.target;
  const isTyping = t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA");
  if (isTyping) return;

  e.preventDefault();
  doBuzz();
});

// ===============================
// Leave Button
// ===============================
leaveBtn?.addEventListener("click", () => {
  if (confirm("Möchtest du das Spiel verlassen?")) {
    socket.emit("player-leave-teams-local");
    window.location.href = "/jeopardy-teams.html";
  }
});

// ===============================
// Socket Events
// ===============================
socket.on("teams-updated", (serverTeams) => {
  teams = serverTeams || {};
  renderTeamSelection();

  // Update team badge if joined
  if (joined && currentTeamId && teams[currentTeamId]) {
    const team = teams[currentTeamId];
    if (teamBadge) {
      teamBadge.textContent = team.name;
      teamBadge.className = `team-badge team-${team.colorId || 'blue'}`;
    }
  }
});

socket.on("buzzing-status", ({ enabled }) => {
  buzzingEnabled = !!enabled;
  updateBuzzerState();

  if (statusText) {
    statusText.textContent = enabled ? "Buzzer ist FREI!" : "Buzzer gesperrt";
    statusText.className = enabled ? "status-text" : "status-text";
  }
});

socket.on("you-are-locked", () => {
  isLocked = true;
  updateBuzzerState();
});

socket.on("round-reset", () => {
  isLocked = false;
  updateBuzzerState();
});

socket.on("player-buzzed-first", ({ playerId: buzzedId, name, teamId, teamName }) => {
  if (statusText) {
    statusText.textContent = `${name} (${teamName || "Team"}) hat gebuzzert!`;
    statusText.className = "status-text buzzed";
  }
});

socket.on("game-ended", () => {
  alert("Das Spiel wurde beendet.");
  window.location.href = "/jeopardy-teams.html";
});

// ===============================
// Init
// ===============================
socket.on("connect", () => {
  console.log("Verbunden mit Server");
  // Request current teams for local mode
  socket.emit("request-teams-local");
});

socket.on("disconnect", () => {
  console.log("Verbindung verloren");
  if (statusText) statusText.textContent = "Verbindung verloren...";
});
