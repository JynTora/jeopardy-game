// public/host-teams.js
// Host Panel für Jeopardy Teams Modus

const socket = io();

// DOM Elements
const hostPassModal = document.getElementById("hostPassModal");
const hostPassInput = document.getElementById("hostPassInput");
const hostPassOk = document.getElementById("hostPassOk");
const hostPassCancel = document.getElementById("hostPassCancel");
const hostPassError = document.getElementById("hostPassError");
const roomCodeDisplay = document.getElementById("roomCodeDisplay");
const openBoardBtn = document.getElementById("openBoardBtn");
const openBoardCamBtn = document.getElementById("openBoardCamBtn");
const enableBuzzBtn = document.getElementById("enableBuzzBtn");
const disableBuzzBtn = document.getElementById("disableBuzzBtn");
const buzzerStatusText = document.getElementById("buzzerStatusText");
const teamsGrid = document.getElementById("teamsGrid");
const newTeamName = document.getElementById("newTeamName");
const addTeamBtn = document.getElementById("addTeamBtn");
const buzzName = document.getElementById("buzzName");
const buzzTeam = document.getElementById("buzzTeam");

// State
let roomCode = null;
let teams = {};
let players = {};

const teamColors = ["red", "blue", "green", "purple", "orange", "pink"];
let colorIndex = 0;

// ================================
// Password Modal
// ================================
hostPassOk?.addEventListener("click", createGame);
hostPassCancel?.addEventListener("click", () => {
  window.location.href = "/jeopardy-teams.html";
});

hostPassInput?.addEventListener("keydown", (e) => {
  if (e.key === "Enter") createGame();
});

function createGame() {
  const password = hostPassInput?.value || "";
  if (!password) {
    hostPassError.textContent = "Bitte Passwort eingeben";
    return;
  }

  socket.emit("host-create-teams-game", { password }, (response) => {
    if (response?.success) {
      roomCode = response.roomCode;
      hostPassModal?.classList.add("hidden");
      roomCodeDisplay.textContent = roomCode;
      openBoardBtn.disabled = false;
      openBoardCamBtn.disabled = false;
    } else {
      hostPassError.textContent = response?.error || "Fehler beim Erstellen";
    }
  });
}

// ================================
// Board Buttons
// ================================
openBoardBtn?.addEventListener("click", () => {
  if (roomCode) {
    window.open(`/board-teams.html?room=${roomCode}`, "_blank");
  }
});

openBoardCamBtn?.addEventListener("click", () => {
  if (roomCode) {
    window.open(`/board-teams-cam.html?room=${roomCode}`, "_blank");
  }
});

// ================================
// Buzzer Controls
// ================================
enableBuzzBtn?.addEventListener("click", () => {
  if (roomCode) {
    socket.emit("host-set-buzzing", { roomCode, enabled: true });
  }
});

disableBuzzBtn?.addEventListener("click", () => {
  if (roomCode) {
    socket.emit("host-set-buzzing", { roomCode, enabled: false });
  }
});

// ================================
// Teams Management
// ================================
addTeamBtn?.addEventListener("click", addTeam);
newTeamName?.addEventListener("keydown", (e) => {
  if (e.key === "Enter") addTeam();
});

function addTeam() {
  const name = newTeamName?.value?.trim();
  if (!name || !roomCode) return;

  const colorId = teamColors[colorIndex % teamColors.length];
  colorIndex++;

  socket.emit("teams-create-team", { roomCode, name, colorId });
  newTeamName.value = "";
}

function renderTeams() {
  if (!teamsGrid) return;

  const teamEntries = Object.entries(teams);

  if (teamEntries.length === 0) {
    teamsGrid.innerHTML = '<div class="no-teams">Noch keine Teams erstellt.</div>';
    return;
  }

  teamsGrid.innerHTML = teamEntries.map(([tid, team]) => {
    const members = (team.members || [])
      .map(pid => {
        const p = players[pid];
        if (!p) return null;
        const statusClass = p.connected === false ? "offline" : "";
        return `<div class="team-member"><span class="member-status ${statusClass}"></span>${p.name}</div>`;
      })
      .filter(Boolean)
      .join("");

    return `
      <div class="team-card team-${team.colorId || 'blue'}">
        <div class="team-header">
          <span class="team-color-dot"></span>
          <span class="team-name">${team.name}</span>
        </div>
        <div class="team-score">${team.score || 0} Punkte</div>
        <div class="team-members">${members || '<span style="color:#64748b">Keine Spieler</span>'}</div>
      </div>
    `;
  }).join("");
}

// ================================
// Socket Events
// ================================
socket.on("teams-updated", (serverTeams) => {
  teams = serverTeams || {};
  renderTeams();
});

socket.on("players-updated", (serverPlayers) => {
  players = serverPlayers || {};
  renderTeams();
});

socket.on("buzzing-status", ({ enabled }) => {
  if (buzzerStatusText) {
    buzzerStatusText.textContent = enabled ? "Buzzer ist FREIGEGEBEN!" : "Buzzer aktuell gesperrt.";
    buzzerStatusText.style.color = enabled ? "#4ade80" : "#94a3b8";
  }
});

socket.on("player-buzzed-first", ({ playerId, name, teamId, teamName }) => {
  if (buzzName) {
    buzzName.textContent = name || "—";
  }
  if (buzzTeam && teamName) {
    buzzTeam.textContent = `Team: ${teamName}`;
    buzzTeam.style.display = "block";
  }
});

socket.on("game-ended", () => {
  alert("Das Spiel wurde beendet.");
  window.location.href = "/jeopardy-teams.html";
});
