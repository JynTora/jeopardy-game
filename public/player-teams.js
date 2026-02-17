// public/player-teams.js
// Local Buzzer für Jeopardy Teams Modus

const socket = io();

// ===============================
// DOM Elements
// ===============================
const joinView          = document.getElementById("joinView");
const playerNameInput   = document.getElementById("playerName");
const roomCodeInput     = document.getElementById("roomCode");
const teamSelection     = document.getElementById("teamSelection");
const newTeamNameInput  = document.getElementById("newTeamName");
const joinBtn           = document.getElementById("joinBtn");
const errorMsg          = document.getElementById("errorMsg");

const buzzerView        = document.getElementById("buzzerView");
const playerNameDisplay = document.getElementById("playerNameDisplay");
const playerTeamDisplay = document.getElementById("playerTeamDisplay");
const buzzerBtn         = document.getElementById("buzzerBtn");
const buzzerStatus      = document.getElementById("buzzerStatus");

// ===============================
// Audio
// ===============================
const sfxBuzz = new Audio("/sounds/buzzer-button.wav");
sfxBuzz.preload = "auto";

// ===============================
// State
// ===============================
let joined        = false;
let currentTeamId = null;
let playerName    = "";
let playerId      = null;
let buzzingEnabled = false;
let isLocked      = false;
let teams         = {};

window.selectedTeamId = null;

// ===============================
// Team Selection UI (Tab: Beitreten)
// ===============================
function renderTeamSelection() {
  if (!teamSelection) return;

  const entries = Object.entries(teams);

  if (entries.length === 0) {
    teamSelection.innerHTML = '<div class="no-teams-msg">Noch keine Teams vorhanden</div>';
    return;
  }

  teamSelection.innerHTML = entries.map(([tid, team]) => {
    const count    = (team.members || []).length;
    const selected = window.selectedTeamId === tid ? "selected" : "";
    return `
      <div class="team-option team-${team.colorId || 'blue'} ${selected}" data-team-id="${tid}">
        <div class="team-option-name">${team.name}</div>
        <div class="team-option-count">${count} Spieler</div>
      </div>`;
  }).join("");

  teamSelection.querySelectorAll(".team-option").forEach(el => {
    el.addEventListener("click", () => {
      window.selectedTeamId = el.dataset.teamId;
      renderTeamSelection();
      updateJoinBtn();
    });
  });
}

// ===============================
// Join Button State
// ===============================
function updateJoinBtn() {
  const name = playerNameInput?.value.trim();
  const room = roomCodeInput?.value.trim();
  const tab  = window.getCurrentTab?.() || 'join';
  let teamReady = false;

  if (tab === 'join') {
    teamReady = !!window.selectedTeamId;
  } else {
    teamReady = (newTeamNameInput?.value.trim().length > 0);
  }

  if (joinBtn) joinBtn.disabled = !(name && room && teamReady);
}

playerNameInput?.addEventListener("input", updateJoinBtn);
roomCodeInput?.addEventListener("input", updateJoinBtn);
newTeamNameInput?.addEventListener("input", updateJoinBtn);

// ===============================
// Join Button Click
// ===============================
joinBtn?.addEventListener("click", () => {
  const name    = playerNameInput?.value.trim();
  const room    = roomCodeInput?.value.trim();
  const tab     = window.getCurrentTab?.() || 'join';
  const color   = window.getSelectedColor?.() || 'red';

  if (!name || !room) return;
  if (errorMsg) errorMsg.textContent = "";

  if (tab === 'create') {
    // 1. Team erstellen, dann beitreten
    const teamName = newTeamNameInput?.value.trim();
    if (!teamName) return;

    socket.emit("teams-create-team-local", { roomCode: room, name: teamName, colorId: color }, (res) => {
      if (!res?.success) {
        if (errorMsg) errorMsg.textContent = res?.error || "Team konnte nicht erstellt werden";
        return;
      }
      const teamId = res.teamId;
      doJoin(name, room, teamId);
    });

  } else {
    // Bestehendem Team beitreten
    if (!window.selectedTeamId) return;
    doJoin(name, room, window.selectedTeamId);
  }
});

function doJoin(name, room, teamId) {
  playerName    = name;
  currentTeamId = teamId;

  socket.emit("player-join-teams-local", { name, roomCode: room, teamId }, (res) => {
    if (res?.success) {
      playerId = res.playerId;
      joined   = true;
      showBuzzerUI();
    } else {
      if (errorMsg) errorMsg.textContent = res?.error || "Fehler beim Beitreten";
    }
  });
}

// ===============================
// Show Buzzer UI
// ===============================
function showBuzzerUI() {
  if (joinView)   joinView.classList.add("hidden");
  if (buzzerView) buzzerView.classList.add("active");

  if (playerNameDisplay) playerNameDisplay.textContent = playerName;

  const team = teams[currentTeamId];
  if (playerTeamDisplay && team) {
    playerTeamDisplay.textContent = `Team: ${team.name}`;
    playerTeamDisplay.style.color = teamColor(team.colorId);
  }

  updateBuzzerState();
}

function teamColor(colorId) {
  const map = {
    red: '#f87171', blue: '#60a5fa', green: '#4ade80',
    purple: '#c084fc', orange: '#fb923c', pink: '#f472b6'
  };
  return map[colorId] || '#f9fafb';
}

// ===============================
// Buzzer State
// ===============================
function updateBuzzerState() {
  if (!buzzerBtn) return;

  if (isLocked) {
    buzzerBtn.className = "buzzer-btn";
    buzzerBtn.disabled  = true;
    if (buzzerStatus) buzzerStatus.textContent = "Du bist gesperrt";
    return;
  }

  if (buzzingEnabled) {
    buzzerBtn.className = "buzzer-btn free";
    buzzerBtn.disabled  = false;
    if (buzzerStatus) buzzerStatus.textContent = "Buzzer ist FREI!";
  } else {
    buzzerBtn.className = "buzzer-btn";
    buzzerBtn.disabled  = true;
    if (buzzerStatus) buzzerStatus.textContent = "Warte auf Freigabe...";
  }
}

// ===============================
// Buzzer Action
// ===============================
function doBuzz() {
  if (!joined || !buzzingEnabled || isLocked) return;

  sfxBuzz.currentTime = 0;
  sfxBuzz.play().catch(() => {});

  socket.emit("player-buzz-teams-local", { teamId: currentTeamId });

  buzzingEnabled = false;
  updateBuzzerState();
}

buzzerBtn?.addEventListener("click", doBuzz);

document.addEventListener("keydown", (e) => {
  if (e.code !== "Space") return;
  if (!joined) return;
  const t = e.target;
  if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA")) return;
  e.preventDefault();
  doBuzz();
});

// ===============================
// Socket Events
// ===============================
socket.on("teams-updated", (serverTeams) => {
  teams = serverTeams || {};
  renderTeamSelection();

  if (joined && currentTeamId && teams[currentTeamId] && playerTeamDisplay) {
    const team = teams[currentTeamId];
    playerTeamDisplay.textContent = `Team: ${team.name}`;
    playerTeamDisplay.style.color = teamColor(team.colorId);
  }
});

socket.on("buzzing-status", ({ enabled }) => {
  buzzingEnabled = !!enabled;
  updateBuzzerState();
});

socket.on("you-are-locked", () => {
  isLocked = true;
  updateBuzzerState();
});

socket.on("round-reset", () => {
  isLocked = false;
  updateBuzzerState();
});

socket.on("player-buzzed-first", ({ name, teamName }) => {
  if (buzzerStatus) {
    buzzerStatus.textContent = `${name} (${teamName || "Team"}) hat gebuzzert!`;
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
  socket.emit("request-teams-local");
});

socket.on("disconnect", () => {
  if (buzzerStatus) buzzerStatus.textContent = "Verbindung verloren...";
});
