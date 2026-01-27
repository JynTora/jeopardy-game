// public/board-cam.js
// ═══════════════════════════════════════════════════════════
// BOARD MIT KAMERA - Empfängt alle Spieler-Streams, sendet Host-Stream
// ═══════════════════════════════════════════════════════════

(function() {
  "use strict";

  console.log("🎥 Board-Cam Extension lädt...");

  // ===============================
  // WebRTC Config mit Metered.ca TURN Servern
  // ===============================
  const rtcConfig = {
    iceServers: [
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'stun:bamangames.metered.live:80' },
      {
        urls: 'turn:bamangames.metered.live:80',
        username: 'f0a80f469f8b8590832f8da3',
        credential: 'crkMbNXmiA79CgUn'
      },
      {
        urls: 'turn:bamangames.metered.live:80?transport=tcp',
        username: 'f0a80f469f8b8590832f8da3',
        credential: 'crkMbNXmiA79CgUn'
      },
      {
        urls: 'turn:bamangames.metered.live:443',
        username: 'f0a80f469f8b8590832f8da3',
        credential: 'crkMbNXmiA79CgUn'
      },
      {
        urls: 'turns:bamangames.metered.live:443',
        username: 'f0a80f469f8b8590832f8da3',
        credential: 'crkMbNXmiA79CgUn'
      }
    ],
    iceCandidatePoolSize: 10
  };

  // ===============================
  // State
  // ===============================
  let hostStream = null;
  const playerStreams = {}; // playerId -> MediaStream
  const incomingPCs = {}; // socketId -> RTCPeerConnection (für eingehende Spieler-Streams)
  const outgoingPCs = {}; // socketId -> RTCPeerConnection (für ausgehenden Host-Stream)
  const socketToPlayer = {}; // socketId -> playerId

  // DOM
  const hostCamBox = document.getElementById("hostCamBox");
  const hostCamVideo = document.getElementById("hostCamVideo");
  const hostCamToggle = document.getElementById("hostCamToggle");
  const playersBarEl = document.getElementById("players-bar");

  // ===============================
  // Host Kamera initialisieren
  // ===============================
  async function initHostCamera() {
    if (!hostCamVideo) return false;

    try {
      hostStream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 320 }, height: { ideal: 240 }, facingMode: "user" },
        audio: false
      });
      hostCamVideo.srcObject = hostStream;
      console.log("✅ Host-Kamera bereit");
      return true;
    } catch (err) {
      console.error("Host camera error:", err);
      if (hostCamBox) {
        hostCamBox.innerHTML = `
          <div style="padding:12px;text-align:center;color:#94a3b8;font-size:0.7rem;">
            <div style="font-size:1.2rem;margin-bottom:4px;">📷</div>
            Keine Kamera
          </div>
        `;
      }
      return false;
    }
  }

  // Toggle
  if (hostCamToggle) {
    hostCamToggle.addEventListener("click", () => {
      if (!hostStream) return;
      const track = hostStream.getVideoTracks()[0];
      if (track) {
        track.enabled = !track.enabled;
        hostCamToggle.textContent = track.enabled ? "📹" : "🚫";
      }
    });
  }

  // ===============================
  // EINGEHEND: Spieler-Stream empfangen
  // ===============================
  function createIncomingPC(socketId, playerId) {
    if (incomingPCs[socketId]) {
      try { incomingPCs[socketId].close(); } catch {}
    }

    const pc = new RTCPeerConnection(rtcConfig);
    incomingPCs[socketId] = pc;
    socketToPlayer[socketId] = playerId;

    pc.ontrack = (event) => {
      console.log("📹 Spieler-Video empfangen:", playerId);
      playerStreams[playerId] = event.streams[0];
      updatePlayerVideo(playerId);
    };

    pc.onicecandidate = (event) => {
      if (event.candidate && typeof boardRoomCode !== 'undefined') {
        socket.emit("webrtc-ice-candidate", {
          roomCode: boardRoomCode,
          targetId: socketId,
          candidate: event.candidate,
          streamType: "player"
        });
      }
    };

    pc.onconnectionstatechange = () => {
      console.log(`Incoming [${playerId}]: ${pc.connectionState}`);
      if (pc.connectionState === "failed" || pc.connectionState === "disconnected") {
        delete playerStreams[playerId];
        updatePlayerVideo(playerId);
      }
    };

    return pc;
  }

  async function handlePlayerOffer(socketId, playerId, offer) {
    console.log("Verarbeite Offer von Spieler:", playerId);
    const pc = createIncomingPC(socketId, playerId);

    try {
      await pc.setRemoteDescription(new RTCSessionDescription(offer));
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);

      socket.emit("webrtc-answer", {
        roomCode: boardRoomCode,
        targetId: socketId,
        answer: pc.localDescription,
        streamType: "player"
      });
      console.log("Answer gesendet an:", playerId);
    } catch (err) {
      console.error("Offer handling error:", err);
    }
  }

  // ===============================
  // AUSGEHEND: Host-Stream an Spectator senden
  // ===============================
  function createOutgoingPC(socketId) {
    if (outgoingPCs[socketId]) {
      try { outgoingPCs[socketId].close(); } catch {}
    }

    const pc = new RTCPeerConnection(rtcConfig);
    outgoingPCs[socketId] = pc;

    // Host-Stream hinzufügen
    if (hostStream) {
      hostStream.getTracks().forEach(track => pc.addTrack(track, hostStream));
    }

    pc.onicecandidate = (event) => {
      if (event.candidate && typeof boardRoomCode !== 'undefined') {
        socket.emit("webrtc-ice-candidate", {
          roomCode: boardRoomCode,
          targetId: socketId,
          candidate: event.candidate,
          streamType: "host"
        });
      }
    };

    pc.onconnectionstatechange = () => {
      console.log(`Outgoing Host->Spectator [${socketId}]: ${pc.connectionState}`);
    };

    return pc;
  }

  async function sendHostOfferTo(targetSocketId) {
    if (!hostStream) {
      console.log("Kein Host-Stream verfügbar");
      return;
    }

    console.log("Sende Host-Offer an:", targetSocketId);
    const pc = createOutgoingPC(targetSocketId);

    try {
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);

      socket.emit("webrtc-offer", {
        roomCode: boardRoomCode,
        targetId: targetSocketId,
        offer: pc.localDescription,
        streamType: "host"
      });
    } catch (err) {
      console.error("Host offer error:", err);
    }
  }

  async function handleHostAnswer(socketId, answer) {
    const pc = outgoingPCs[socketId];
    if (!pc) return;

    try {
      await pc.setRemoteDescription(new RTCSessionDescription(answer));
      console.log("Host-Answer empfangen von:", socketId);
    } catch (err) {
      console.error("Host answer error:", err);
    }
  }

  // ===============================
  // ICE Candidates
  // ===============================
  async function handleIceCandidate(fromSocketId, candidate, streamType) {
    let pc;
    if (streamType === "host") {
      pc = outgoingPCs[fromSocketId];
    } else {
      pc = incomingPCs[fromSocketId];
    }
    if (!pc) return;

    try {
      await pc.addIceCandidate(new RTCIceCandidate(candidate));
    } catch (err) {
      console.error("ICE error:", err);
    }
  }

  // ===============================
  // Video in Spieler-Pill
  // ===============================
  function updatePlayerVideo(playerId) {
    const videoEl = document.getElementById(`video-${playerId}`);
    const placeholder = document.querySelector(`#video-wrap-${playerId} .player-video-placeholder`);

    if (!videoEl) return;

    const stream = playerStreams[playerId];
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
      if (!playersBarEl || !document.body.classList.contains('board-cam-mode')) {
        return originalFn();
      }

      const players = typeof latestPlayers !== 'undefined' ? latestPlayers : {};
      const entries = Object.entries(players);
      playersBarEl.innerHTML = "";

      if (entries.length === 0) {
        playersBarEl.innerHTML = '<div class="players-empty">Noch keine Spieler.</div>';
        return;
      }

      entries.forEach(([id, player]) => {
        const pill = document.createElement("div");
        pill.className = "player-pill";

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

        if (typeof turnActivePlayerId !== 'undefined' && turnActivePlayerId === id) {
          pill.classList.add("player-pill-turn-active");
        }
        if (typeof activePlayerId !== 'undefined' && activePlayerId === id) {
          pill.classList.add("player-pill-active");
        }

        playersBarEl.appendChild(pill);
      });
    };

    console.log("✅ renderPlayersBar override");
  }

  // ===============================
  // Socket Events
  // ===============================
  function setupSocketEvents() {
    if (typeof socket === 'undefined') {
      setTimeout(setupSocketEvents, 100);
      return;
    }

    // Spectator fragt nach Host-Stream
    socket.on("request-host-stream", ({ fromSocketId }) => {
      console.log("Host-Stream angefordert von:", fromSocketId);
      if (hostStream) {
        sendHostOfferTo(fromSocketId);
      }
    });

    // Spieler mit Kamera verbunden
    socket.on("cam-player-connected", ({ playerId, socketId, name }) => {
      console.log("📹 Cam-Spieler verbunden:", name, socketId);
      socketToPlayer[socketId] = playerId;
      
      // WICHTIG: Request den Stream vom Spieler!
      console.log("📤 Fordere Stream an von:", socketId);
      socket.emit("webrtc-request-offer", { 
        roomCode: boardRoomCode, 
        targetId: socketId 
      });
    });

    // Spieler getrennt
    socket.on("cam-player-disconnected", ({ playerId }) => {
      delete playerStreams[playerId];
      updatePlayerVideo(playerId);
    });

    // WebRTC Offer (von Spieler für seinen Stream)
    socket.on("webrtc-offer", ({ fromId, offer, streamType, playerId }) => {
      if (streamType === "player") {
        const pid = playerId || socketToPlayer[fromId] || fromId;
        handlePlayerOffer(fromId, pid, offer);
      }
    });

    // WebRTC Answer
    socket.on("webrtc-answer", ({ fromId, answer, streamType }) => {
      if (streamType === "host") {
        handleHostAnswer(fromId, answer);
      } else {
        const pc = incomingPCs[fromId];
        if (pc) pc.setRemoteDescription(new RTCSessionDescription(answer)).catch(console.error);
      }
    });

    // ICE Candidates
    socket.on("webrtc-ice-candidate", ({ fromId, candidate, streamType }) => {
      handleIceCandidate(fromId, candidate, streamType);
    });

    // Players updated
    socket.on("players-updated", (players) => {
      for (const [playerId, player] of Object.entries(players)) {
        if (player.hasCamera && player.socketId) {
          socketToPlayer[player.socketId] = playerId;
        }
      }
    });

    console.log("✅ Socket-Events");
  }

  // ===============================
  // Board im Cam-Mode joinen
  // ===============================
  function joinWithCamMode() {
    const check = () => {
      if (typeof boardRoomCode !== 'undefined' && boardRoomCode && typeof socket !== 'undefined') {
        socket.emit("board-join-room", { roomCode: boardRoomCode, isCamMode: true });
        
        // Host-Cam bereit melden
        if (hostStream) {
          socket.emit("host-cam-ready", { roomCode: boardRoomCode });
        }
        console.log("✅ Board Cam-Mode joined:", boardRoomCode);
      } else {
        setTimeout(check, 200);
      }
    };
    setTimeout(check, 300);
  }

  // ===============================
  // Buzzer Button Handler (Backup)
  // ===============================
  function setupBuzzerButton() {
    const buzzBtn = document.getElementById("boardBuzzBtn");
    if (buzzBtn) {
      // Entferne alte Handler
      const newBtn = buzzBtn.cloneNode(true);
      buzzBtn.parentNode.replaceChild(newBtn, buzzBtn);
      
      newBtn.addEventListener("click", () => {
        if (typeof boardRoomCode !== 'undefined' && boardRoomCode && typeof socket !== 'undefined') {
          console.log("🔔 Buzzer aktiviert für Raum:", boardRoomCode);
          socket.emit("board-enable-buzz", { roomCode: boardRoomCode });
        }
      });
      console.log("✅ Buzzer-Button Handler aktiviert");
    }
  }

  // ===============================
  // Init
  // ===============================
  async function init() {
    await initHostCamera();
    overridePlayersBar();
    setupSocketEvents();
    joinWithCamMode();
    setupBuzzerButton();
    console.log("🎥 Board-Cam bereit!");
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => setTimeout(init, 100));
  } else {
    setTimeout(init, 100);
  }

})();
