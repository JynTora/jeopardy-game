// public/board-cam.js
// =========================================
// ERWEITERUNG FÜR BOARD.JS - KAMERA SUPPORT
// Muss NACH board.js geladen werden!
// =========================================

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
      { urls: 'stun:stun2.l.google.com:19302' },
    ]
  };

  // ===============================
  // Camera State
  // ===============================
  let hostStream = null;
  let hostCameraReady = false;
  const playerStreams = {}; // { playerId: MediaStream }
  const peerConnections = {}; // { socketId: RTCPeerConnection }
  const socketToPlayer = {}; // { socketId: playerId }

  // DOM Elements
  const hostCamWrap = document.getElementById("hostCamWrap");
  const hostCam = document.getElementById("hostCam");
  const hostCamToggle = document.getElementById("hostCamToggle");
  const playersBarEl = document.getElementById("players-bar");

  // ===============================
  // Host Camera Functions
  // ===============================
  async function initHostCamera() {
    if (!hostCam) {
      console.log("Host cam element not found - skipping");
      return false;
    }

    try {
      hostStream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: 320 },
          height: { ideal: 240 },
          facingMode: "user"
        },
        audio: false
      });

      hostCam.srcObject = hostStream;
      hostCameraReady = true;
      console.log("✅ Host camera ready");

      // Server mitteilen
      if (typeof boardRoomCode !== 'undefined' && boardRoomCode) {
        socket.emit("host-cam-ready", { roomCode: boardRoomCode });
      }

      return true;
    } catch (err) {
      console.error("Host camera error:", err);
      hostCameraReady = false;

      if (hostCamWrap) {
        hostCamWrap.innerHTML = `
          <div style="padding: 20px; text-align: center; color: #94a3b8; font-size: 0.85rem;">
            <div style="font-size: 1.8rem; margin-bottom: 8px;">📷</div>
            Kamera nicht verfügbar
          </div>
        `;
      }

      return false;
    }
  }

  function toggleHostCamera() {
    if (!hostStream) return;

    const videoTrack = hostStream.getVideoTracks()[0];
    if (videoTrack) {
      videoTrack.enabled = !videoTrack.enabled;

      if (hostCamToggle) {
        hostCamToggle.textContent = videoTrack.enabled ? "📹" : "🚫";
        hostCamToggle.style.opacity = videoTrack.enabled ? "1" : "0.5";
      }
    }
  }

  if (hostCamToggle) {
    hostCamToggle.addEventListener("click", toggleHostCamera);
  }

  // ===============================
  // WebRTC - Receive Player Streams
  // ===============================
  function createPeerConnectionForPlayer(socketId, playerId) {
    if (peerConnections[socketId]) {
      try { peerConnections[socketId].close(); } catch {}
    }

    const pc = new RTCPeerConnection(rtcConfig);
    peerConnections[socketId] = pc;
    socketToPlayer[socketId] = playerId;

    // Remote Track empfangen
    pc.ontrack = (event) => {
      console.log("📹 Received video track from:", playerId);

      const stream = event.streams[0];
      playerStreams[playerId] = stream;

      // Video-Element aktualisieren
      updatePlayerVideo(playerId, stream);
    };

    // ICE Candidates senden
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

  async function handlePlayerOffer(socketId, offer) {
    const playerId = socketToPlayer[socketId] || socketId;
    const pc = createPeerConnectionForPlayer(socketId, playerId);

    try {
      await pc.setRemoteDescription(new RTCSessionDescription(offer));
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);

      socket.emit("webrtc-answer", {
        roomCode: boardRoomCode,
        targetId: socketId,
        answer: pc.localDescription
      });

      console.log("Sent WebRTC answer to:", playerId);
    } catch (err) {
      console.error("Error handling player offer:", err);
    }
  }

  async function handleIceCandidate(socketId, candidate) {
    const pc = peerConnections[socketId];
    if (!pc) return;

    try {
      await pc.addIceCandidate(new RTCIceCandidate(candidate));
    } catch (err) {
      console.error("Error adding ICE candidate:", err);
    }
  }

  function requestOfferFromPlayer(socketId) {
    if (typeof boardRoomCode === 'undefined' || !boardRoomCode) return;

    socket.emit("webrtc-request-offer", {
      roomCode: boardRoomCode,
      targetId: socketId
    });

    console.log("Requested WebRTC offer from:", socketId);
  }

  // ===============================
  // Update Player Video in Bar
  // ===============================
  function updatePlayerVideo(playerId, stream) {
    const videoEl = document.getElementById(`video-${playerId}`);
    const wrapEl = document.getElementById(`video-wrap-${playerId}`);
    
    if (!videoEl) {
      // Video-Element existiert noch nicht, wird beim nächsten renderPlayersBar erstellt
      return;
    }

    const placeholder = wrapEl?.querySelector('.player-video-placeholder');

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
  // Warte bis board.js geladen ist und überschreibe die Funktion
  function setupPlayersBarOverride() {
    if (typeof window.renderPlayersBar !== 'function') {
      console.log("Waiting for board.js to load...");
      setTimeout(setupPlayersBarOverride, 100);
      return;
    }

    const originalRenderPlayersBar = window.renderPlayersBar;

    window.renderPlayersBar = function() {
      if (!playersBarEl) return;

      // Prüfen ob wir im Cam-Mode sind
      if (!document.body.classList.contains('board-cam-mode')) {
        // Nicht im Cam-Mode, original verwenden
        return originalRenderPlayersBar();
      }

      const players = typeof latestPlayers !== 'undefined' ? latestPlayers : {};
      const entries = Object.entries(players);

      playersBarEl.innerHTML = "";
      playersBarEl.classList.add("players-bar-cam");

      if (entries.length === 0) {
        playersBarEl.innerHTML = '<div class="players-empty">Noch keine Spieler verbunden.</div>';
        return;
      }

      entries.forEach(([id, player]) => {
        const pill = document.createElement("div");
        pill.className = "player-pill player-pill-cam";

        // Video-Container
        const videoWrap = document.createElement("div");
        videoWrap.className = "player-video-wrap";
        videoWrap.id = `video-wrap-${id}`;

        // Placeholder
        const placeholder = document.createElement("div");
        placeholder.className = "player-video-placeholder";
        placeholder.textContent = (player.name?.charAt(0) || "?").toUpperCase();

        // Video Element
        const videoEl = document.createElement("video");
        videoEl.className = "player-video";
        videoEl.id = `video-${id}`;
        videoEl.autoplay = true;
        videoEl.muted = true;
        videoEl.playsInline = true;

        // Falls Stream schon vorhanden
        if (playerStreams[id]) {
          videoEl.srcObject = playerStreams[id];
          placeholder.style.display = "none";
        } else {
          videoEl.classList.add("hidden");
        }

        videoWrap.appendChild(placeholder);
        videoWrap.appendChild(videoEl);

        // Info
        const infoDiv = document.createElement("div");
        infoDiv.className = "player-info";

        const nameSpan = document.createElement("span");
        nameSpan.className = "player-name";
        nameSpan.textContent = player.name || "(Unbekannt)";

        const scoreSpan = document.createElement("span");
        scoreSpan.className = "player-score";
        scoreSpan.textContent = `${player.score ?? 0} Pkt`;

        infoDiv.appendChild(nameSpan);
        infoDiv.appendChild(scoreSpan);

        pill.appendChild(videoWrap);
        pill.appendChild(infoDiv);

        // States von board.js
        if (typeof turnActivePlayerId !== 'undefined' && turnActivePlayerId === id) {
          pill.classList.add("player-pill-turn-active");
        } else if (typeof turnPreviewPlayerId !== 'undefined' && turnPreviewPlayerId === id) {
          pill.classList.add("player-pill-turn-preview");
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

    console.log("✅ Players bar override installed");
  }

  // ===============================
  // Socket Events für WebRTC
  // ===============================
  function setupSocketEvents() {
    if (typeof socket === 'undefined') {
      console.log("Waiting for socket...");
      setTimeout(setupSocketEvents, 100);
      return;
    }

    // Spieler mit Kamera verbunden
    socket.on("cam-player-connected", ({ playerId, socketId, name }) => {
      console.log("📹 Cam player connected:", name, "(", playerId, ")");

      socketToPlayer[socketId] = playerId;

      // Kurz warten, dann Offer anfordern
      setTimeout(() => {
        requestOfferFromPlayer(socketId);
      }, 500);
    });

    // Spieler getrennt
    socket.on("cam-player-disconnected", ({ playerId }) => {
      console.log("📹 Cam player disconnected:", playerId);

      delete playerStreams[playerId];
      updatePlayerVideo(playerId, null);

      // Peer Connection aufräumen
      for (const [sid, pid] of Object.entries(socketToPlayer)) {
        if (pid === playerId && peerConnections[sid]) {
          try { peerConnections[sid].close(); } catch {}
          delete peerConnections[sid];
          delete socketToPlayer[sid];
        }
      }
    });

    // WebRTC Offer von Spieler
    socket.on("webrtc-offer", ({ fromId, offer }) => {
      console.log("Received WebRTC offer from:", fromId);
      handlePlayerOffer(fromId, offer);
    });

    // WebRTC Answer
    socket.on("webrtc-answer", ({ fromId, answer }) => {
      const pc = peerConnections[fromId];
      if (!pc) return;

      pc.setRemoteDescription(new RTCSessionDescription(answer))
        .then(() => console.log("Remote description set for:", fromId))
        .catch(err => console.error("Error:", err));
    });

    // ICE Candidate
    socket.on("webrtc-ice-candidate", ({ fromId, candidate }) => {
      handleIceCandidate(fromId, candidate);
    });

    // Wenn neue Spieler kommen, Offers anfordern
    const originalPlayersUpdated = socket._callbacks?.['$players-updated']?.[0];
    
    socket.on("players-updated", (players) => {
      // Check ob Spieler mit Kamera dabei sind
      for (const [playerId, player] of Object.entries(players)) {
        if (player.hasCamera && player.connected && player.socketId) {
          socketToPlayer[player.socketId] = playerId;

          // Wenn noch keine Verbindung, Offer anfordern
          if (!playerStreams[playerId] && !peerConnections[player.socketId]) {
            setTimeout(() => {
              requestOfferFromPlayer(player.socketId);
            }, 300);
          }
        }
      }
    });

    console.log("✅ WebRTC socket events installed");
  }

  // ===============================
  // Board Join mit Cam-Mode Flag
  // ===============================
  function setupBoardJoinOverride() {
    // Warte auf boardRoomCode
    const checkAndJoin = () => {
      if (typeof boardRoomCode !== 'undefined' && boardRoomCode) {
        // Erneut joinen mit isCamMode flag
        socket.emit("board-join-room", { 
          roomCode: boardRoomCode, 
          isCamMode: true 
        });
        console.log("✅ Joined room in cam mode:", boardRoomCode);

        // Host-Cam dem Server melden
        if (hostCameraReady) {
          socket.emit("host-cam-ready", { roomCode: boardRoomCode });
        }
      } else {
        setTimeout(checkAndJoin, 200);
      }
    };

    setTimeout(checkAndJoin, 500);
  }

  // ===============================
  // Initialize
  // ===============================
  async function init() {
    // Host Kamera starten
    await initHostCamera();

    // Override installieren
    setupPlayersBarOverride();

    // Socket Events
    setupSocketEvents();

    // Board Join mit Cam-Mode
    setupBoardJoinOverride();

    console.log("🎥 Board-Cam Extension geladen!");
  }

  // Start wenn DOM bereit
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    // DOM ist bereits geladen, kurz warten bis board.js fertig ist
    setTimeout(init, 200);
  }

})();
