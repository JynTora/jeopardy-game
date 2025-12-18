// server/index.ts
import express, { Request, Response, NextFunction } from "express";
import http from "http";
import { Server } from "socket.io";
import path from "path";
import { fileURLToPath } from "url";

// __dirname Nachbau für ES Modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Environment configuration
const config = {
  port: process.env.PORT ? Number(process.env.PORT) : 5000,
  env: process.env.NODE_ENV || "development",
  corsOrigins: process.env.CORS_ORIGINS?.split(",").map(o => o.trim()) || ["*"],
};

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: config.corsOrigins,
    methods: ["GET", "POST"],
  },
});

// Request logging middleware
app.use((req: Request, res: Response, next: NextFunction) => {
  const start = Date.now();
  res.on("finish", () => {
    const duration = Date.now() - start;
    console.log(
      `[${new Date().toISOString()}] ${req.method} ${req.url} ${res.statusCode} - ${duration}ms`
    );
  });
  next();
});

// CORS middleware for API endpoints
app.use((req: Request, res: Response, next: NextFunction) => {
  const origin = req.headers.origin;
  if (config.corsOrigins.includes("*") || (origin && config.corsOrigins.includes(origin))) {
    res.setHeader("Access-Control-Allow-Origin", origin || "*");
  }
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  
  if (req.method === "OPTIONS") {
    res.sendStatus(200);
    return;
  }
  next();
});

// JSON body parsing
app.use(express.json());

// Statische Dateien aus dem public-Ordner (eine Ebene über /server)
app.use(express.static(path.join(__dirname, "..", "public")));

type Player = {
  name: string;
  score: number;
};

type Game = {
  hostId: string;
  players: Record<string, Player>;
  buzzingEnabled: boolean;
  firstBuzzId: string | null;
};

const games: Record<string, Game> = {};

// Raumcode erzeugen (z.B. X59XC)
function createRoomCode(): string {
  return Math.random().toString(36).substring(2, 7).toUpperCase();
}

io.on("connection", (socket) => {
  console.log("Client verbunden:", socket.id);

  // --------------------------------
  // Host erstellt ein Spiel
  // --------------------------------
  socket.on(
    "host-create-game",
    (callback: (data: { roomCode: string }) => void) => {
      const roomCode = createRoomCode();
      games[roomCode] = {
        hostId: socket.id,
        players: {},
        buzzingEnabled: false,
        firstBuzzId: null,
      };

      socket.join(roomCode);
      console.log("Game erstellt:", roomCode);
      callback({ roomCode });
    },
  );

  // --------------------------------
  // Board joint bestehenden Room
  // --------------------------------
  socket.on("board-join-room", ({ roomCode }: { roomCode: string }) => {
    if (!roomCode) return;

    const game = games[roomCode];
    if (!game) {
      // Falls es den Raum nicht gibt → leere Liste schicken
      socket.emit("players-updated", {});
      return;
    }

    socket.join(roomCode);
    socket.emit("players-updated", game.players);
    console.log("Board joined Room:", roomCode);
  });

  // --------------------------------
  // Spieler joint
  // --------------------------------
  socket.on(
    "player-join",
    (
      { roomCode, name }: { roomCode: string; name: string },
      callback: (res: { success: boolean; error?: string }) => void,
    ) => {
      const game = games[roomCode];
      if (!game) {
        return callback({ success: false, error: "Room nicht gefunden" });
      }

      // Prüfen, ob es schon einen Spieler mit diesem Namen gibt
      // (auch wenn gerade " (offline)" dranhängt)
      let existingId: string | null = null;
      let existingScore = 0;

      for (const [id, player] of Object.entries(game.players)) {
        const baseName = player.name.replace(" (offline)", "");
        if (baseName === name) {
          existingId = id;
          existingScore = player.score;
          break;
        }
      }

      // Wenn ja: alten Eintrag entfernen, Punkte übernehmen
      if (existingId) {
        delete game.players[existingId];
        game.players[socket.id] = {
          name, // ohne "(offline)"
          score: existingScore,
        };
      } else {
        // Wenn nein: neuen Spieler mit 0 Punkten anlegen
        game.players[socket.id] = { name, score: 0 };
      }

      socket.join(roomCode);
      io.to(roomCode).emit("players-updated", game.players);
      callback({ success: true });
    },
  );

  // --------------------------------
  // Host schaltet Buzzer an/aus
  // --------------------------------
  socket.on(
    "host-set-buzzing",
    ({ roomCode, enabled }: { roomCode: string; enabled: boolean }) => {
      const game = games[roomCode];
      if (!game || game.hostId !== socket.id) return;

      game.buzzingEnabled = enabled;
      game.firstBuzzId = null;
      io.to(roomCode).emit("buzzing-status", { enabled });
    },
  );

  // --------------------------------
  // Board kann ebenfalls Buzzer freigeben
  // (nach falscher Antwort)
  // --------------------------------
  socket.on("board-enable-buzz", ({ roomCode }: { roomCode: string }) => {
    const game = games[roomCode];
    if (!game) return;

    game.buzzingEnabled = true;
    game.firstBuzzId = null;
    io.to(roomCode).emit("buzzing-status", { enabled: true });
  });

  // --------------------------------
  // Spieler drückt Buzzer
  // --------------------------------
  socket.on("player-buzz", ({ roomCode }: { roomCode: string }) => {
    const game = games[roomCode];
    if (!game || !game.buzzingEnabled) return;

    // wenn schon jemand zuerst war → ignorieren
    if (game.firstBuzzId) return;

    const player = game.players[socket.id];
    if (!player) return;

    // diesen Spieler als "ersten" merken
    game.firstBuzzId = socket.id;

    // Info an ALLE Clients in diesem Raum schicken
    io.to(roomCode).emit("player-buzzed-first", {
      socketId: socket.id,
      name: player.name,
    });

    // Buzzer wieder sperren
    game.buzzingEnabled = false;
    io.to(roomCode).emit("buzzing-status", { enabled: false });
  });

  // --------------------------------
  // Host ändert Punkte
  // --------------------------------
  socket.on(
    "host-update-score",
    ({
      roomCode,
      playerId,
      delta,
    }: {
      roomCode: string;
      playerId: string;
      delta: number;
    }) => {
      const game = games[roomCode];
      if (!game || game.hostId !== socket.id) return;
      if (!game.players[playerId]) return;

      game.players[playerId].score += delta;
      io.to(roomCode).emit("players-updated", game.players);
    },
  );

  // --------------------------------
  // Board ändert Punkte (richtig/falsch im Overlay)
  // --------------------------------
  socket.on(
    "board-update-score",
    ({
      roomCode,
      playerId,
      delta,
    }: {
      roomCode: string;
      playerId: string;
      delta: number;
    }) => {
      const game = games[roomCode];
      if (!game) return;
      if (!game.players[playerId]) return;

      game.players[playerId].score += delta;
      io.to(roomCode).emit("players-updated", game.players);
    },
  );

  // --------------------------------
  // Optional: Keep-Alive vom Client
  // --------------------------------
  socket.on("keep-alive", () => {
    // aktuell nur Platzhalter
    // console.log("Keep-Alive von", socket.id);
  });

  // --------------------------------
  // Disconnect
  // --------------------------------
  socket.on("disconnect", () => {
    console.log("Client getrennt:", socket.id);

    for (const [roomCode, game] of Object.entries(games)) {
      // Wenn der Host weg ist → Spiel beenden
      if (game.hostId === socket.id) {
        io.to(roomCode).emit("game-ended");
        delete games[roomCode];
        break;
      }

      // Spieler NICHT löschen – nur optional als offline markieren
      if (game.players[socket.id]) {
        const p = game.players[socket.id];
        if (!p.name.endsWith(" (offline)")) {
          p.name = p.name + " (offline)";
        }
        io.to(roomCode).emit("players-updated", game.players);
      }
    }
  });
});

// API routes example
app.get("/api/health", (req: Request, res: Response) => {
  res.json({ 
    status: "ok", 
    environment: config.env,
    timestamp: new Date().toISOString() 
  });
});

// 404 handler - must be after all other routes
app.use((req: Request, res: Response) => {
  res.status(404).sendFile(path.join(__dirname, "..", "public", "404.html"));
});

// 500 error handler
app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
  console.error(`[${new Date().toISOString()}] Error:`, err.stack);
  res.status(500).sendFile(path.join(__dirname, "..", "public", "500.html"));
});

// Start server
server.listen(config.port, "0.0.0.0", () => {
  console.log(`Server running on port ${config.port} (${config.env} mode)`);
});
