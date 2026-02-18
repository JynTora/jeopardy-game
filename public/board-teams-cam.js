// public/board-teams-cam.js
// ═══════════════════════════════════════════════════════════
// BOARD TEAMS MIT KAMERA - WebRTC für Teams
// ═══════════════════════════════════════════════════════════

(function() {
  "use strict";

  console.log("🎥 Board-Teams-Cam lädt...");

  // ===============================
  // WebRTC Config
  // ===============================
  const rtcConfig = {
    iceServers: [
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'stun:stun1.l.google.com:19302' },
      {
        urls: 'turn:bamangames.metered.live:80',
        username: 'f0a80f469f8b8590832f8da3',
        credential: 'crkMbNXmiA79CgUn'
      },
      {
        urls: 'turn:bamangames.metered.live:443',
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
  const incomingPCs = {}; // socketId -> RTCPeerConnection
  const outgoingPCs = {}; // socketId -> RTCPeerConnection
  const socketToPlayer = {}; // socketId -> playerId

  // DOM
  const hostCamVideo = document.getElementById("hostCamVideo");
  const hostCamToggle = document.getElementById("hostCamToggle");
  const teamsBarEl = document.getElementById("teamsBar");

  // ===============================
  // Host Kamera
  // ===============================
  async function initHostCamera() {
    if (!hostCamVideo) return false;
    try {
      hostStream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 320 }, height: { ideal: 240 } },
        audio: false
      });
      hostCamVideo.srcObject = hostStream;
      console.log("✅ Host-Kamera bereit");
      return true;
    } catch (err) {
      console.error("Host camera error:", err);
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
      }
    });
  }

  // ===============================
  // EINGEHEND: Spieler-Stream
  // ===============================
  function createIncomingPC(socketId, playerId) {
    if (incomingPCs[socketId]) {
      try { incomingPCs[socketId].close(); } catch {}
    }

    const pc = new RTCPeerConnection(rtcConfig);
    incomingPCs[socketId] = pc;
    socketToPlayer[socketId] = playerId;

    pc.ontrack = (event) => {
      console.log("📹 Stream empfangen:", playerId);
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
      if (pc.connectionState === "failed") {
        delete playerStreams[playerId];
        updatePlayerVideo(playerId);
        setTimeout(() => {
          if (!playerStreams[playerId]) {
            socket.emit("webrtc-request-offer", { roomCode: boardRoomCode, targetId: socketId });
          }
        }, 2000);
      }
    };

    return pc;
  }

  async function handlePlayerOffer(socketId, playerId, offer) {
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
    } catch (err) {
      console.error("Offer handling error:", err);
    }
  }

  // ===============================
  // AUSGEHEND: Host-Stream
  // ===============================
  function createOutgoingPC(socketId) {
    if (outgoingPCs[socketId]) {
      try { outgoingPCs[socketId].close(); } catch {}
    }

    const pc = new RTCPeerConnection(rtcConfig);
    outgoingPCs[socketId] = pc;

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

    return pc;
  }

  async function sendHostOfferTo(targetSocketId) {
    if (!hostStream) return;
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
    } catch (err) {
      console.error("Host answer error:", err);
    }
  }

  // ===============================
  // ICE Candidates
  // ===============================
  async function handleIceCandidate(fromSocketId, candidate, streamType) {
    const pc = streamType === "host" ? outgoingPCs[fromSocketId] : incomingPCs[fromSocketId];
    if (!pc) return;
    try {
      await pc.addIceCandidate(new RTCIceCandidate(candidate));
    } catch (err) {
      console.error("ICE error:", err);
    }
  }

  // ===============================
  // Video aktualisieren
  // ===============================
  function updatePlayerVideo(playerId) {
    const videoEl = document.getElementById(`video-${playerId}`);
    const placeholder = document.querySelector(`#video-wrap-${playerId} .player-cam-placeholder`);
    if (!videoEl) return;

    const stream = playerStreams[playerId];
    if (stream) {
      videoEl.srcObject = stream;
      videoEl.style.display = "block";
      if (placeholder) placeholder.style.display = "none";
    } else {
      videoEl.srcObject = null;
      videoEl.style.display = "none";
      if (placeholder) placeholder.style.display = "flex";
    }
  }

  // ===============================
  // Team-Cam Rendering
  // ===============================
  function overrideRenderTeamsBar() {
    if (typeof window.renderTeamsBar !== 'function') {
      setTimeout(overrideRenderTeamsBar, 100);
      return;
    }

    const originalFn = window.renderTeamsBar;

    window.renderTeamsBar = function() {
      if (!teamsBarEl || !document.body.classList.contains('board-teams-cam')) {
        return originalFn();
      }

      // Verwende globale Teams/Players von board-teams.js
      const teams = typeof window.latestTeams !== 'undefined' ? window.latestTeams : {};
      const players = typeof window.latestPlayers !== 'undefined' ? window.latestPlayers : {};
      const entries = Object.entries(teams);
      
      console.log("🎨 Rendering Teams Bar:", entries.length, "Teams");
      
      teamsBarEl.innerHTML = "";

      if (entries.length === 0) {
        teamsBarEl.innerHTML = '<div style="color:#64748b;padding:12px;">Noch keine Teams</div>';
        return;
      }

      entries.forEach(([teamId, team]) => {
        const isActive = typeof window.activeTeamId !== 'undefined' && window.activeTeamId === teamId;

        const teamGroup = document.createElement("div");
        teamGroup.className = `team-cam-group team-${team.colorId || 'blue'} ${isActive ? 'team-active' : ''}`;

        // Header
        const header = document.createElement("div");
        header.className = "team-cam-header";
        
        const nameDiv = document.createElement("div");
        nameDiv.className = "team-cam-name";
        nameDiv.innerHTML = `<span class="team-color-dot"></span><span>${team.name}</span>`;
        
        const scoreDiv = document.createElement("div");
        scoreDiv.className = "team-cam-score";
        scoreDiv.textContent = `${team.score || 0} Punkte`;
        
        header.appendChild(nameDiv);
        header.appendChild(scoreDiv);

        // Spieler-Kameras
        const playersDiv = document.createElement("div");
        playersDiv.className = "team-cam-players";

        const memberIds = team.members || [];
        memberIds.forEach(pid => {
          const player = players[pid];
          if (!player) return;

          const card = document.createElement("div");
          card.className = "player-cam-card";
          if (typeof window.activePlayerId !== 'undefined' && window.activePlayerId === pid) {
            card.classList.add("player-buzzed");
          }

          const videoWrap = document.createElement("div");
          videoWrap.className = "player-cam-video-wrap";
          videoWrap.id = `video-wrap-${pid}`;

          const placeholder = document.createElement("div");
          placeholder.className = "player-cam-placeholder";
          placeholder.textContent = (player.name?.charAt(0) || "?").toUpperCase();

          const video = document.createElement("video");
          video.className = "player-cam-video";
          video.id = `video-${pid}`;
          video.autoplay = true;
          video.muted = true;
          video.playsInline = true;

          if (playerStreams[pid]) {
            video.srcObject = playerStreams[pid];
            video.style.display = "block";
            placeholder.style.display = "none";
          } else {
            video.style.display = "none";
          }

          videoWrap.appendChild(placeholder);
          videoWrap.appendChild(video);

          const nameLabel = document.createElement("div");
          nameLabel.className = "player-cam-name";
          nameLabel.textContent = player.name || "?";

          card.appendChild(videoWrap);
          card.appendChild(nameLabel);
          playersDiv.appendChild(card);
        });

        teamGroup.appendChild(header);
        teamGroup.appendChild(playersDiv);
        teamsBarEl.appendChild(teamGroup);
      });
    };

    console.log("✅ renderTeamsBar override");
  }

  // ===============================
  // Socket Events
  // ===============================
  function setupSocketEvents() {
    if (typeof socket === 'undefined') {
      setTimeout(setupSocketEvents, 100);
      return;
    }

    socket.on("request-host-stream", ({ fromSocketId }) => {
      if (hostStream) sendHostOfferTo(fromSocketId);
    });

    socket.on("cam-player-connected", ({ playerId, socketId, name }) => {
      console.log("📹 Cam-Spieler:", name, socketId, playerId);
      socketToPlayer[socketId] = playerId;
      
      const requestStream = () => {
        if (!playerStreams[playerId]) {
          socket.emit("webrtc-request-offer", { roomCode: boardRoomCode, targetId: socketId });
        }
      };
      requestStream();
      [1000, 3000, 6000].forEach(delay => {
        setTimeout(() => { if (!playerStreams[playerId]) requestStream(); }, delay);
      });
    });

    socket.on("cam-player-disconnected", ({ playerId }) => {
      delete playerStreams[playerId];
      updatePlayerVideo(playerId);
    });

    socket.on("webrtc-offer", ({ fromId, offer, streamType, playerId }) => {
      if (streamType === "player") {
        const pid = playerId || socketToPlayer[fromId] || fromId;
        handlePlayerOffer(fromId, pid, offer);
      }
    });

    socket.on("webrtc-answer", ({ fromId, answer, streamType }) => {
      if (streamType === "host") handleHostAnswer(fromId, answer);
      else {
        const pc = incomingPCs[fromId];
        if (pc) pc.setRemoteDescription(new RTCSessionDescription(answer)).catch(console.error);
      }
    });

    socket.on("webrtc-ice-candidate", ({ fromId, candidate, streamType }) => {
      handleIceCandidate(fromId, candidate, streamType);
    });

    socket.on("players-updated", (players) => {
      for (const [playerId, player] of Object.entries(players)) {
        if (player.hasCamera && player.socketId && player.connected) {
          socketToPlayer[player.socketId] = playerId;
          if (!playerStreams[playerId]) {
            socket.emit("webrtc-request-offer", { roomCode: boardRoomCode, targetId: player.socketId });
          }
        }
      }
    });

    setInterval(() => {
      if (typeof boardRoomCode !== 'undefined' && boardRoomCode) {
        socket.emit("request-players", { roomCode: boardRoomCode });
      }
    }, 5000);

    socket.on("players-list", (players) => {
      for (const [playerId, player] of Object.entries(players)) {
        if (player.hasCamera && player.socketId && player.connected && !playerStreams[playerId]) {
          socketToPlayer[player.socketId] = playerId;
          socket.emit("webrtc-request-offer", { roomCode: boardRoomCode, targetId: player.socketId });
        }
      }
    });

    console.log("✅ Socket-Events");
  }

  // ===============================
  // Board joinen
  // ===============================
  function joinWithCamMode() {
    const check = () => {
      if (typeof boardRoomCode !== 'undefined' && boardRoomCode && typeof socket !== 'undefined') {
        socket.emit("board-join-room", { roomCode: boardRoomCode, isCamMode: true });
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
  // Init
  // ===============================
  async function init() {
    await initHostCamera();
    overrideRenderTeamsBar();
    setupSocketEvents();
    joinWithCamMode();
    console.log("🎥 Board-Teams-Cam bereit!");
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => setTimeout(init, 100));
  } else {
    setTimeout(init, 100);
  }

})();
