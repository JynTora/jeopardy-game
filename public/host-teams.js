// public/host-teams.js
// Host Panel für Jeopardy Teams Modus

const socket = io();

// ===============================
// DOM Elements
// ===============================
const roomCodeDisplay = document.getElementById("roomCodeDisplay");
const openBoardBtn = document.getElementById("openBoardBtn");
const openBoardCamBtn = document.getElementById("openBoardCamBtn");
const enableBuzzBtn = document.getElementById("enableBuzzBtn");
const disableBuzzBtn = document.getElementById("disableBuzzBtn");
const buzzerStatusText = document.getElementById("buzzerStatusText");
const teamsGrid = document.getElementById("teamsGrid");
const newTeamNameInput = document.getElementById("newTeamName");
const addTeamBtn = document.getElementById("addTeamBtn");
const buzzName = document.getElementById("buzzName");
const buzzTeam = document.getElementById("buzzTeam");

// Password Modal
const hostPassModal = document.getElementById("hostPassModal");
const hostPassInput = document.getElementById("hostPassInput");
const hostPassError = document.getElementById("hostPassError");
const hostPassOk = document.getElementById("hostPassOk");
const hostPassCancel = document.getElementById("hostPassCancel");

// ===============================
// State
// ===============================
let currentRoomCode = null;
let teams = {}; // { teamId: { name, color, score, members: [playerId, ...] } }
let players = {}; // { playerId: { name, score, connected, teamId } }

// Team Farben
const TEAM_COLORS = [
  { id: "red", name: "Rot", hex: "#ef4444" },
  { id: "blue", name: "Blau", hex: "#3b82f6" },
  { id: "green", name: "Grün", hex: "#22c55e" },
  { id: "purple", name: "Lila", hex: "#a855f7" },
  { id: "orange", name: "Orange", hex: "#f97316" },
  { id: "pink", name: "Pink", hex: "#ec4899" },
];

let colorIndex = 0;

// ===============================
// Password Modal Functions
// ===============================
function showHostPassModal() {
  hostPassModal?.classList.remove("hidden");
  hostPassInput?.focus();
}

function hideHostPassModal() {
  hostPassModal?.classList.add("hidden");
}

function setHostPassError(msg) {
  if (hostPassError) hostPassError.textContent = msg || "";
}

function createGameWithPassword(password) {
  socket.emit("host-create-teams-game", { password }, (res) => {
    if (res?.success) {
      currentRoomCode = res.roomCode;
      if (roomCodeDisplay) roomCodeDisplay.textContent = currentRoomCode;
      if (openBoardBtn) openBoardBtn.disabled = false;
      if (openBoardCamBtn) openBoardCamBtn.disabled = false;
      hideHostPassModal();
      console.log("Teams-Spiel erstellt:", currentRoomCode);
    } else {
      setHostPassError(res?.error || "Fehler beim Erstellen");
    }
  });
}

// ===============================
// Init: Show password modal
// ===============================
showHostPassModal();

// Password Modal Events
hostPassOk?.addEventListener("click", () => {
  createGameWithPassword(hostPassInput?.value || "");
});

hostPassCancel?.addEventListener("click", () => {
  setHostPassError("Ohne Passwort kein Zugriff.");
});

hostPassInput?.addEventListener("keydown", (e) => {
  if (e.key === "Enter") {
    createGameWithPassword(hostPassInput.value || "");
  }
});

// ===============================
// Board Buttons
// ===============================
openBoardBtn?.addEventListener("click", () => {
  if (!currentRoomCode) return;
  const url = `/board-teams.html?room=${encodeURIComponent(currentRoomCode)}`;
  window.open(url, "_blank");
});

openBoardCamBtn?.addEventListener("click", () => {
  if (!currentRoomCode) return;
  const url = `/board-teams-cam.html?room=${encodeURIComponent(currentRoomCode)}`;
  window.open(url, "_blank");
});

// ===============================
// Buzzer Buttons
// ===============================
enableBuzzBtn?.addEventListener("click", () => {
  if (!currentRoomCode) return;
  socket.emit("host-set-buzzing", { roomCode: currentRoomCode, enabled: true });
  if (buzzerStatusText) buzzerStatusText.textContent = "Buzzer aktuell freigegeben.";
});

disableBuzzBtn?.addEventListener("click", () => {
  if (!currentRoomCode) return;
  socket.emit("host-set-buzzing", { roomCode: currentRoomCode, enabled: false });
  if (buzzerStatusText) buzzerStatusText.textContent = "Buzzer aktuell gesperrt.";
});

// ===============================
// Team Management
// ===============================
addTeamBtn?.addEventListener("click", () => {
  const name = newTeamNameInput?.value?.trim();
  if (!name || !currentRoomCode) return;

  const color = TEAM_COLORS[colorIndex % TEAM_COLORS.length];
  colorIndex++;

  socket.emit("teams-create-team", { roomCode: currentRoomCode, name, colorId: color.id });
  if (newTeamNameInput) newTeamNameInput.value = "";
});

newTeamNameInput?.addEventListener("keydown", (e) => {
  if (e.key === "Enter") {
    addTeamBtn?.click();
  }
});

// ===============================
// Render Teams
// ===============================
function renderTeams() {
  if (!teamsGrid) return;

  const teamEntries = Object.entries(teams);

  if (teamEntries.length === 0) {
    teamsGrid.innerHTML = '<div class="no-teams">Noch keine Teams erstellt.</div>';
    return;
  }

  teamsGrid.innerHTML = teamEntries.map(([teamId, team]) => {
    const members = (team.members || [])
      .map((pid) => {
        const p = players[pid];
        if (!p) return null;
        const statusClass = p.connected === false ? "offline" : "";
        return `<div class="team-member"><span class="member-status ${statusClass}"></span> ${p.name}</div>`;
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
        <div class="team-members">
          ${members || '<span style="color:#64748b;font-style:italic;">Keine Spieler</span>'}
        </div>
      </div>
    `;
  }).join("");
}

// ===============================
// Socket Events
// ===============================
socket.on("teams-updated", (serverTeams) => {
  teams = serverTeams || {};
  renderTeams();
});

socket.on("players-updated", (serverPlayers) => {
  players = serverPlayers || {};
  renderTeams();
});

socket.on("player-buzzed-first", ({ playerId, name, teamId, teamName }) => {
  if (buzzName) buzzName.textContent = name || "—";
  if (buzzTeam) {
    if (teamName) {
      buzzTeam.textContent = `Team: ${teamName}`;
      buzzTeam.style.display = "block";
    } else {
      buzzTeam.style.display = "none";
    }
  }
});

socket.on("buzzing-status", ({ enabled }) => {
  if (buzzerStatusText) {
    buzzerStatusText.textContent = enabled ? "Buzzer aktuell freigegeben." : "Buzzer aktuell gesperrt.";
  }
  
  // Reset buzz display when buzzer is enabled
  if (enabled) {
    if (buzzName) buzzName.textContent = "—";
    if (buzzTeam) buzzTeam.style.display = "none";
  }
});

socket.on("game-ended", () => {
  alert("Das Spiel wurde beendet.");
  window.location.href = "/jeopardy-teams.html";
});

// ===============================
// Reconnect handling
// ===============================
socket.on("connect", () => {
  console.log("Verbunden mit Server");
});

socket.on("disconnect", () => {
  console.log("Verbindung zum Server verloren");
});
