// public/host.js
const socket = io();

const roomCodeEl = document.getElementById("roomCode");
const playersContainer = document.getElementById("playersContainer");
const btnEnableBuzz = document.getElementById("btnEnableBuzz");
const btnDisableBuzz = document.getElementById("btnDisableBuzz");
const buzzStatusEl = document.getElementById("buzzStatus");
const firstBuzzInfo = document.getElementById("firstBuzzInfo");

// Modal Elements
const hostPassModal = document.getElementById("hostPassModal");
const hostPassInput = document.getElementById("hostPassInput");
const hostPassError = document.getElementById("hostPassError");
const hostPassOk = document.getElementById("hostPassOk");
const hostPassCancel = document.getElementById("hostPassCancel");

let currentRoomCode = null;
let players = {};

function setHostPassError(msg) {
  if (hostPassError) hostPassError.textContent = msg || "";
}

function openHostPassModal() {
  if (!hostPassModal) {
    // Fallback (nur falls jemand das Modal-HTML gelöscht hat)
    const pw = prompt("Host-Passwort:") || "";
    return createGameWithPassword(pw);
  }
  setHostPassError("");
  hostPassModal.classList.remove("hidden");
  setTimeout(() => hostPassInput?.focus(), 0);
}

function closeHostPassModal() {
  if (hostPassModal) hostPassModal.classList.add("hidden");
}

// ===== Spieler-Liste =====
function renderPlayers() {
  if (!playersContainer) return;

  playersContainer.innerHTML = "";
  const ids = Object.keys(players || {});

  if (ids.length === 0) {
    playersContainer.innerHTML =
      '<div class="player-row"><span>Noch keine Spieler 🙃</span></div>';
    return;
  }

  ids.forEach((id) => {
    const p = players[id] || {};

    const row = document.createElement("div");
    row.className = "player-row";

    const left = document.createElement("div");
    left.className = "player-row-left";

    const statusSpan = document.createElement("span");
    statusSpan.className = "player-status-dot";
    statusSpan.textContent = p.connected === false ? "🔴" : "🟢";

    const nameSpan = document.createElement("span");
    nameSpan.textContent = p.name || "(Unbekannt)";

    left.appendChild(statusSpan);
    left.appendChild(nameSpan);

    const right = document.createElement("div");
    right.className = "score-controls";

    const scoreEl = document.createElement("strong");
    scoreEl.textContent = String(p.score ?? 0);

    const plus = document.createElement("button");
    plus.textContent = "+";
    plus.className = "plus";
    plus.onclick = () => {
      if (!currentRoomCode) return;
      socket.emit("host-update-score", {
        roomCode: currentRoomCode,
        playerId: id,
        delta: 50,
      });
    };

    const minus = document.createElement("button");
    minus.textContent = "–";
    minus.className = "minus";
    minus.onclick = () => {
      if (!currentRoomCode) return;
      socket.emit("host-update-score", {
        roomCode: currentRoomCode,
        playerId: id,
        delta: -50,
      });
    };

    right.appendChild(scoreEl);
    right.appendChild(plus);
    right.appendChild(minus);

    row.appendChild(left);
    row.appendChild(right);

    playersContainer.appendChild(row);
  });
}

// ===== Host Create Game (PASSWORT GESCHÜTZT) =====
function createGameWithPassword(passwordRaw) {
  const password = String(passwordRaw || "").trim();
  if (!password) {
    setHostPassError("Bitte Passwort eingeben.");
    return;
  }

  socket.emit("host-create-game", { password }, (res) => {
    if (!res || !res.success) {
      setHostPassError(res?.error || "Falsches Passwort.");
      return;
    }

    currentRoomCode = res.roomCode;
    if (roomCodeEl) roomCodeEl.textContent = currentRoomCode;

    try {
      localStorage.setItem("jyn-jeopardy-room", currentRoomCode);
    } catch {}

    closeHostPassModal();
  });
}

// Modal Buttons
hostPassOk?.addEventListener("click", () => {
  createGameWithPassword(hostPassInput?.value || "");
});

hostPassCancel?.addEventListener("click", () => {
  setHostPassError("Ohne Passwort kein Zugriff.");
});

hostPassInput?.addEventListener("keydown", (e) => {
  if (e.key === "Enter") createGameWithPassword(hostPassInput?.value || "");
});

// Beim Laden: Modal öffnen (und NICHT automatisch Spiel erstellen)
openHostPassModal();

// ===== Socket Events =====
socket.on("players-updated", (serverPlayers) => {
  players = serverPlayers || {};
  renderPlayers();
});

socket.on("buzzing-status", ({ enabled }) => {
  if (!buzzStatusEl) return;
  buzzStatusEl.textContent = enabled
    ? "Buzzer ist FREIGEGEBEN."
    : "Buzzer aktuell gesperrt.";
});

socket.on("player-buzzed-first", ({ playerId, name }) => {
  if (!firstBuzzInfo) return;
  firstBuzzInfo.textContent = `${name} war zuerst! (ID: ${playerId})`;
});

// Buttons
btnEnableBuzz?.addEventListener("click", () => {
  if (!currentRoomCode) return;
  if (firstBuzzInfo) firstBuzzInfo.textContent = "Warte auf den ersten Buzz...";
  socket.emit("host-set-buzzing", { roomCode: currentRoomCode, enabled: true });
});

btnDisableBuzz?.addEventListener("click", () => {
  if (!currentRoomCode) return;
  socket.emit("host-set-buzzing", {
    roomCode: currentRoomCode,
    enabled: false,
  });
});
