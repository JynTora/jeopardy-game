// public/board-cam.js
// ═══════════════════════════════════════════════════════════
// KAMERA-ERWEITERUNG FÜR BOARD.JS
// Muss NACH board.js geladen werden!
// ═══════════════════════════════════════════════════════════

(function() {
  "use strict";

  console.log("🎥 Board-Cam Extension wird geladen...");

  // ===============================
  // WebRTC Configuration
  // ===============================
  const rtcConfig = {
    iceServers: [
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'stun:stun1.l.google.com:19302' },
    ]
  };

  // ===============================
  // State
  // ===============================
  let hostStream = null;
  const playerStreams = {}; // { playerId: MediaStream }
  const peerConnections = {}; // { socketId: RTCPeerConnection }
  const socketToPlayer = {}; // { socketId: playerId }

  // DOM
  const hostCamWrap = document.getElementById("hostCamWrap");
  const hostCam = document.getElementById("hostCam");
  const hostCamToggle = document.getElementById("hostCamToggle");
  const playersBarEl = document.getElementById("players-bar");

  // ===============================
  // Host Camera
  // ===============================
  async function initHostCamera() {
    if (!hostCam) return false;

    try {
      hostStream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 320 }, height: { ideal: 240 }, facingMode: "user" },
        audio: false
      });

      hostCam.srcObject = hostStream;
      console.log("✅ Host camera ready");

      // Server informieren
      setTimeout(() => {
        if (typeof boardRoomCode !== 'undefined' && boardRoomCode) {
          socket.emit("host-cam-ready", { roomCode: boardRoomCode });
        }
      }, 500);

      return true;
    } catch (err) {
      console.error("Host camera error:", err);
      if (hostCamWrap) {
        hostCamWrap.innerHTML = `
          <div style="padding: 20px; text-align: center; color: #94a3b8; font-size: 0.8rem;">
            <div style="font-size: 1.5rem; margin-bottom: 6px;">📷</div>
            Kamera nicht verfügbar
          </div>
        `;
      }
      return false;
    }
  }

  if (hostCamToggle) {
    hostCamToggle.addEventListener("click", () => {
      if (!hostStream) return;
      const track = hostStream.getVideoTracks()[0];
      if (track) {
        track.enabled = !track.enabled;
        hostCamToggle.textContent = track.enabled ? "📹" : "🚫";
        hostCamToggle.style.opacity = track.enabled ? "1" : "0.5";
      }
    });
  }

  // ===============================
  // WebRTC - Player Streams empfangen
  // ===============================
  function createPeerConnection(socketId, playerId) {
    if (peerConnections[socketId]) {
      try { peerConnections[socketId].close(); } catch {}
    }

    const pc = new RTCPeerConnection(rtcConfig);
    peerConnections[socketId] = pc;
    socketToPlayer[socketId] = playerId;

    pc.ontrack = (event) => {
      console.log("📹 Video-Track empfangen von:", playerId);
      const stream = event.streams[0];
      playerStreams[playerId] = stream;
      updatePlayerVideo(playerId, stream);
    };

    pc.onicecandidate = (event) => {
      if (event.candidate && typeof boardRoomCode !== 'undefined') {
        socket.emit("webrtc-ice-candidate", {
          roomCode: boardRoomCode,
          targetId: socketId,
          candidate: event.candidate
        });
      }
    };

    pc.onconnectionstatechange = () => {
      console.log(`WebRTC [${playerId}]: ${pc.connectionState}`);
      if (pc.connectionState === "disconnected" || pc.connectionState === "failed") {
        delete playerStreams[playerId];
        updatePlayerVideo(playerId, null);
      }
    };

    return pc;
  }

  async function handleOffer(socketId, offer) {
    const playerId = socketToPlayer[socketId] || socketId;
    const pc = createPeerConnection(socketId, playerId);

    try {
      await pc.setRemoteDescription(new RTCSessionDescription(offer));
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);

      socket.emit("webrtc-answer", {
        roomCode: boardRoomCode,
        targetId: socketId,
        answer: pc.localDescription
      });
      console.log("Answer gesendet an:", playerId);
    } catch (err) {
      console.error("Offer handling error:", err);
    }
  }

  function requestOffer(socketId) {
    if (typeof boardRoomCode === 'undefined' || !boardRoomCode) return;
    socket.emit("webrtc-request-offer", { roomCode: boardRoomCode, targetId: socketId });
    console.log("Offer angefordert von:", socketId);
  }

  // ===============================
  // Video in Spieler-Pill aktualisieren
  // ===============================
  function updatePlayerVideo(playerId, stream) {
    const videoEl = document.getElementById(`video-${playerId}`);
    const placeholder = document.querySelector(`#video-wrap-${playerId} .player-video-placeholder`);

    if (!videoEl) return;

    if (stream) {
      videoEl.srcObject = stream;
      videoEl.classList.remove("hidden");
      if (placeholder) placeholder.style.display = "none";
    } else {
      videoEl.srcObject = null;
      videoEl.classList.add("hidden");
      if (placeholder) placeholder.style.display = "flex";
    }
  }

  // ===============================
  // Override renderPlayersBar
  // ===============================
  function overridePlayersBar() {
    if (typeof window.renderPlayersBar !== 'function') {
      setTimeout(overridePlayersBar, 100);
      return;
    }

    const originalFn = window.renderPlayersBar;

    window.renderPlayersBar = function() {
      if (!playersBarEl) return;

      // Prüfen ob Cam-Mode aktiv
      if (!document.body.classList.contains('board-cam-mode')) {
        return originalFn();
      }

      const players = typeof latestPlayers !== 'undefined' ? latestPlayers : {};
      const entries = Object.entries(players);

      playersBarEl.innerHTML = "";

      if (entries.length === 0) {
        playersBarEl.innerHTML = '<div class="players-empty">Noch keine Spieler verbunden.</div>';
        return;
      }

      entries.forEach(([id, player]) => {
        const pill = document.createElement("div");
        pill.className = "player-pill";

        // Video Container
        const videoWrap = document.createElement("div");
        videoWrap.className = "player-video-wrap";
        videoWrap.id = `video-wrap-${id}`;

        const placeholder = document.createElement("div");
        placeholder.className = "player-video-placeholder";
        placeholder.textContent = (player.name?.charAt(0) || "?").toUpperCase();

        const video = document.createElement("video");
        video.className = "player-video";
        video.id = `video-${id}`;
        video.autoplay = true;
        video.muted = true;
        video.playsInline = true;

        if (playerStreams[id]) {
          video.srcObject = playerStreams[id];
          placeholder.style.display = "none";
        } else {
          video.classList.add("hidden");
        }

        videoWrap.appendChild(placeholder);
        videoWrap.appendChild(video);

        // Info
        const info = document.createElement("div");
        info.className = "player-info";

        const name = document.createElement("span");
        name.className = "player-name";
        name.textContent = player.name || "(Unbekannt)";

        const score = document.createElement("span");
        score.className = "player-score";
        score.textContent = `${player.score ?? 0} Pkt`;

        info.appendChild(name);
        info.appendChild(score);

        pill.appendChild(videoWrap);
        pill.appendChild(info);

        // States
        if (typeof turnActivePlayerId !== 'undefined' && turnActivePlayerId === id) {
          pill.classList.add("player-pill-turn-active");
        }
        if (typeof activePlayerId !== 'undefined' && activePlayerId === id) {
          pill.classList.add("player-pill-active");
        }
        if (typeof lockedPlayersLocal !== 'undefined' && lockedPlayersLocal.has(id)) {
          pill.classList.add("player-pill-locked");
        }

        playersBarEl.appendChild(pill);
      });
    };

    console.log("✅ renderPlayersBar override installiert");
  }

  // ===============================
  // Socket Events
  // ===============================
  function setupSocketEvents() {
    if (typeof socket === 'undefined') {
      setTimeout(setupSocketEvents, 100);
      return;
    }

    socket.on("cam-player-connected", ({ playerId, socketId, name }) => {
      console.log("📹 Cam-Spieler verbunden:", name);
      socketToPlayer[socketId] = playerId;
      setTimeout(() => requestOffer(socketId), 300);
    });

    socket.on("cam-player-disconnected", ({ playerId }) => {
      console.log("📹 Cam-Spieler getrennt:", playerId);
      delete playerStreams[playerId];
      updatePlayerVideo(playerId, null);
    });

    socket.on("webrtc-offer", ({ fromId, offer }) => {
      handleOffer(fromId, offer);
    });

    socket.on("webrtc-answer", ({ fromId, answer }) => {
      const pc = peerConnections[fromId];
      if (pc) {
        pc.setRemoteDescription(new RTCSessionDescription(answer)).catch(console.error);
      }
    });

    socket.on("webrtc-ice-candidate", ({ fromId, candidate }) => {
      const pc = peerConnections[fromId];
      if (pc) {
        pc.addIceCandidate(new RTCIceCandidate(candidate)).catch(console.error);
      }
    });

    // Bei players-updated: Offers für neue Cam-Spieler anfordern
    socket.on("players-updated", (players) => {
      for (const [playerId, player] of Object.entries(players)) {
        if (player.hasCamera && player.connected && player.socketId) {
          socketToPlayer[player.socketId] = playerId;
          if (!playerStreams[playerId] && !peerConnections[player.socketId]) {
            setTimeout(() => requestOffer(player.socketId), 200);
          }
        }
      }
    });

    console.log("✅ WebRTC Socket-Events installiert");
  }

  // ===============================
  // Board im Cam-Mode joinen
  // ===============================
  function joinWithCamMode() {
    const check = () => {
      if (typeof boardRoomCode !== 'undefined' && boardRoomCode && typeof socket !== 'undefined') {
        socket.emit("board-join-room", { roomCode: boardRoomCode, isCamMode: true });
        console.log("✅ Board joined in Cam-Mode:", boardRoomCode);
      } else {
        setTimeout(check, 200);
      }
    };
    setTimeout(check, 300);
  }

  // ===============================
  // Init
  // ===============================
  async function init() {
    await initHostCamera();
    overridePlayersBar();
    setupSocketEvents();
    joinWithCamMode();
    console.log("🎥 Board-Cam Extension geladen!");
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => setTimeout(init, 100));
  } else {
    setTimeout(init, 100);
  }

})();
