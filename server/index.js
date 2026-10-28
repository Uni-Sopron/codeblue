import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const publicPath = path.join(__dirname, 'public');

const PORT = process.env.PORT || 3001;
const app = express();

app.use(cors({ origin: '*' }));
app.use(express.json({ limit: '256kb' }));
app.use(express.static(publicPath));

// In-memory room storage
// Key: roomCode (e.g. "CB-4821"), Value: Room object
const rooms = new Map();

// Constants & Helpers
const ALLOWED_AVATARS = ['surgeon', 'diagnostician', 'chief_physician', 'resident'];
const AVATAR_TITLES = {
  surgeon: 'Dr. Sebész',
  diagnostician: 'Dr. Diagnoszta',
  chief_physician: 'Dr. Főorvos',
  resident: 'Dr. Rezidens',
};

function sanitizeName(rawName, fallback = 'Orvos') {
  if (typeof rawName !== 'string') return fallback;
  const stripped = rawName.replace(/<[^>]*>?/gm, '').trim();
  return stripped.length > 0 ? stripped.slice(0, 32) : fallback;
}

function isValidRoomCode(code) {
  return typeof code === 'string' && /^CB-\d{4}$/.test(code.trim().toUpperCase());
}

function sanitizeAvatar(avatarId) {
  return ALLOWED_AVATARS.includes(avatarId) ? avatarId : 'surgeon';
}

function sanitizeColor(color, fallback = '#00b4d8') {
  if (typeof color === 'string' && /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(color)) {
    return color;
  }
  return fallback;
}

// Generate unique 4-digit room code
function generateRoomCode() {
  const digits = Math.floor(1000 + Math.random() * 9000);
  const code = `CB-${digits}`;
  return rooms.has(code) ? generateRoomCode() : code;
}

// Rate Limiter per socket connection to prevent flooding
const socketMessageCounts = new Map();
function isRateLimited(socketId) {
  const now = Date.now();
  const entry = socketMessageCounts.get(socketId) || { count: 0, resetAt: now + 1000 };
  if (now > entry.resetAt) {
    entry.count = 1;
    entry.resetAt = now + 1000;
  } else {
    entry.count += 1;
  }
  socketMessageCounts.set(socketId, entry);
  return entry.count > 40; // Max 40 events per second
}

// Periodic Garbage Collector for inactive rooms (TTL: 3 hours)
const ROOM_TTL_MS = 3 * 60 * 60 * 1000;
setInterval(() => {
  const now = Date.now();
  for (const [code, room] of rooms.entries()) {
    const lastActive = room.lastActive || new Date(room.createdAt).getTime();
    if (now - lastActive > ROOM_TTL_MS) {
      rooms.delete(code);
      console.log(`[GC] Evicted inactive room ${code}`);
    }
  }
}, 30 * 60 * 1000);

// Health check endpoint
app.get('/health', (_req, res) => {
  res.json({
    status: 'ok',
    service: 'codeblue-multiplayer',
    activeRooms: rooms.size,
    timestamp: new Date().toISOString(),
  });
});

app.get('/rooms', (_req, res) => {
  const publicRooms = Array.from(rooms.values()).map((r) => ({
    code: r.code,
    playerCount: r.players.length,
    gameStarted: r.gameStarted,
    createdAt: r.createdAt,
  }));
  res.json({ rooms: publicRooms });
});

// Single Page Application Fallback
app.get('*', (req, res, next) => {
  if (req.path.startsWith('/socket.io') || req.path === '/health' || req.path === '/rooms') {
    return next();
  }
  res.sendFile(path.join(publicPath, 'index.html'), (err) => {
    if (err) next();
  });
});

const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST'],
  },
  pingTimeout: 30000,
  pingInterval: 10000,
  maxHttpBufferSize: 512 * 1024, // 512 KB payload max
});

io.on('connection', (socket) => {
  console.log(`[Socket] Client connected: ${socket.id}`);

  // Current room of this socket
  let currentRoomCode = null;

  // 1. Create a new room (Host)
  socket.on('room:create', ({ playerName, avatarId, color }, callback) => {
    try {
      if (isRateLimited(socket.id)) return;

      const roomCode = generateRoomCode();
      const sanitizedName = sanitizeName(playerName, '1. Orvos');
      const chosenAvatar = sanitizeAvatar(avatarId);
      const chosenColor = sanitizeColor(color, '#00b4d8');

      const hostPlayer = {
        socketId: socket.id,
        id: 'p1',
        name: sanitizedName,
        avatar: chosenAvatar,
        avatarTitle: AVATAR_TITLES[chosenAvatar] || 'Dr. Sebész',
        color: chosenColor,
        isHost: true,
        connected: true,
      };

      const room = {
        code: roomCode,
        hostSocketId: socket.id,
        players: [hostPlayer],
        gameStarted: false,
        gameState: null,
        rematchVotes: {},
        disconnectTimer: null,
        createdAt: new Date().toISOString(),
        lastActive: Date.now(),
      };

      rooms.set(roomCode, room);
      socket.join(roomCode);
      currentRoomCode = roomCode;

      console.log(`[Room Created] ${roomCode} by ${hostPlayer.name} (${socket.id})`);

      const response = { success: true, roomCode, player: hostPlayer, room };
      if (typeof callback === 'function') callback(response);
      socket.emit('room:created', response);
    } catch (err) {
      console.error('[room:create error]', err);
      if (typeof callback === 'function') callback({ success: false, error: err.message });
    }
  });

  // 2. Join existing room
  socket.on('room:join', ({ roomCode, playerName, avatarId, color }, callback) => {
    try {
      if (isRateLimited(socket.id)) return;

      if (!isValidRoomCode(roomCode)) {
        const error = 'Érvénytelen szobakód formátum! (Példa: CB-4821)';
        if (typeof callback === 'function') callback({ success: false, error });
        socket.emit('room:error', { error });
        return;
      }

      const normalizedCode = roomCode.trim().toUpperCase();
      const room = rooms.get(normalizedCode);

      if (!room) {
        const error = `A megadott szoba (${normalizedCode}) nem található!`;
        if (typeof callback === 'function') callback({ success: false, error });
        socket.emit('room:error', { error });
        return;
      }

      if (room.gameStarted) {
        const error = 'A játék ebben a szobában már elkezdődött!';
        if (typeof callback === 'function') callback({ success: false, error });
        socket.emit('room:error', { error });
        return;
      }

      if (room.players.length >= 4) {
        const error = 'A szoba megtelt! Maximum 4 orvos játszhat.';
        if (typeof callback === 'function') callback({ success: false, error });
        socket.emit('room:error', { error });
        return;
      }

      // Check for avatar collision
      let chosenAvatar = sanitizeAvatar(avatarId);
      const avatarTaken = room.players.some((p) => p.avatar === chosenAvatar);
      if (avatarTaken) {
        const takenAvatars = new Set(room.players.map((p) => p.avatar));
        const available = ALLOWED_AVATARS.find((a) => !takenAvatars.has(a));
        if (available) {
          chosenAvatar = available;
        }
      }

      const playerIndex = room.players.length + 1;
      const sanitizedName = sanitizeName(playerName, `${playerIndex}. Orvos`);
      const chosenColor = sanitizeColor(color, '#38bdf8');

      const newPlayer = {
        socketId: socket.id,
        id: `p${playerIndex}`,
        name: sanitizedName,
        avatar: chosenAvatar,
        avatarTitle: AVATAR_TITLES[chosenAvatar] || `Dr. ${chosenAvatar}`,
        color: chosenColor,
        isHost: false,
        connected: true,
      };

      room.players.push(newPlayer);
      room.lastActive = Date.now();
      socket.join(normalizedCode);
      currentRoomCode = normalizedCode;

      console.log(`[Player Joined] ${newPlayer.name} joined room ${normalizedCode}`);

      const response = { success: true, roomCode: normalizedCode, player: newPlayer, room };
      if (typeof callback === 'function') callback(response);
      socket.emit('room:joined', response);

      // Notify all other players in the room
      io.to(normalizedCode).emit('room:update', { room });
    } catch (err) {
      console.error('[room:join error]', err);
      if (typeof callback === 'function') callback({ success: false, error: err.message });
    }
  });

  // 3. Start game (Host only)
  socket.on('room:start', ({ roomCode, initialGameState }, callback) => {
    try {
      if (isRateLimited(socket.id)) return;

      const normalizedCode = roomCode?.trim().toUpperCase();
      const room = rooms.get(normalizedCode);
      if (!room) return;

      if (room.hostSocketId !== socket.id) {
        const error = 'Csak a szobagazda indíthatja el a játékot!';
        if (typeof callback === 'function') callback({ success: false, error });
        return;
      }

      if (room.players.length < 2) {
        const error = 'Legalább 2 orvos szükséges a játék elindításához!';
        if (typeof callback === 'function') callback({ success: false, error });
        return;
      }

      room.gameStarted = true;
      room.gameState = initialGameState;
      room.lastActive = Date.now();

      console.log(`[Game Started] Room ${normalizedCode} with ${room.players.length} players!`);

      io.to(normalizedCode).emit('game:started', {
        roomCode: normalizedCode,
        room,
        gameState: initialGameState,
      });

      if (typeof callback === 'function') callback({ success: true });
    } catch (err) {
      console.error('[room:start error]', err);
      if (typeof callback === 'function') callback({ success: false, error: err.message });
    }
  });

  // 4. Relay action across room
  socket.on('game:action', ({ roomCode, actionType, payload, newGameState }) => {
    try {
      if (isRateLimited(socket.id)) return;

      const normalizedCode = roomCode?.trim().toUpperCase();
      const room = rooms.get(normalizedCode);
      if (!room) return;

      room.lastActive = Date.now();
      if (newGameState) {
        room.gameState = newGameState;
      }

      socket.to(normalizedCode).emit('game:action_broadcast', {
        actionType,
        payload,
        newGameState,
        senderSocketId: socket.id,
      });
    } catch (err) {
      console.error('[game:action error]', err);
    }
  });

  // 5. Full state sync broadcast
  socket.on('game:sync', ({ roomCode, gameState }) => {
    try {
      if (isRateLimited(socket.id)) return;

      const normalizedCode = roomCode?.trim().toUpperCase();
      const room = rooms.get(normalizedCode);
      if (!room) return;

      room.lastActive = Date.now();
      room.gameState = gameState;
      socket.to(normalizedCode).emit('game:sync_broadcast', { gameState });
    } catch (err) {
      console.error('[game:sync error]', err);
    }
  });

  // 6. Player Reconnection
  socket.on('room:reconnect', ({ roomCode, playerId }, callback) => {
    try {
      const normalizedCode = roomCode?.trim().toUpperCase();
      const room = rooms.get(normalizedCode);
      if (!room) {
        if (typeof callback === 'function') callback({ success: false, error: 'A szoba már nem létezik.' });
        return;
      }

      const player = room.players.find((p) => p.id === playerId);
      if (!player) {
        if (typeof callback === 'function') callback({ success: false, error: 'Játékos nem található a szobában.' });
        return;
      }

      if (room.disconnectTimer) {
        clearTimeout(room.disconnectTimer);
        room.disconnectTimer = null;
      }

      player.socketId = socket.id;
      player.connected = true;
      socket.join(normalizedCode);
      currentRoomCode = normalizedCode;
      room.lastActive = Date.now();

      console.log(`[Player Reconnected] ${player.name} (${player.id}) in room ${normalizedCode}`);
      const response = { success: true, room, player, gameState: room.gameState };
      if (typeof callback === 'function') callback(response);
      io.to(normalizedCode).emit('player:reconnected', {
        playerId: player.id,
        playerName: player.name,
      });
      io.to(normalizedCode).emit('room:update', { room });
    } catch (err) {
      console.error('[room:reconnect error]', err);
      if (typeof callback === 'function') callback({ success: false, error: err.message });
    }
  });

  // 7. Rematch Vote & Synchronized Game Reset
  socket.on('room:rematch_vote', ({ roomCode, ready }) => {
    try {
      if (isRateLimited(socket.id)) return;
      const normalizedCode = roomCode?.trim().toUpperCase();
      const room = rooms.get(normalizedCode);
      if (!room) return;

      const player = room.players.find((p) => p.socketId === socket.id);
      if (!player) return;

      if (!room.rematchVotes) room.rematchVotes = {};
      room.rematchVotes[player.id] = !!ready;
      room.lastActive = Date.now();

      io.to(normalizedCode).emit('room:rematch_update', {
        votes: room.rematchVotes,
        requestedBy: player.name,
        requestedById: player.id,
        isHost: !!player.isHost,
        ready: !!ready,
      });

      // Check if all connected players have voted ready
      const connectedPlayers = room.players.filter((p) => p.connected);
      const allReady =
        connectedPlayers.length >= 2 &&
        connectedPlayers.every((p) => room.rematchVotes[p.id] === true);

      if (allReady) {
        room.rematchVotes = {};
        if (room.disconnectTimer) {
          clearTimeout(room.disconnectTimer);
          room.disconnectTimer = null;
        }

        const freshPlayers = room.players.map((p, idx) => ({
          id: `p${idx + 1}`,
          name: p.name,
          color: p.color,
          avatar: p.avatar,
          avatarTitle: p.avatarTitle,
          cash: 1500000,
          debt: 0,
          position: 0,
          builtElements: [],
          skipTurns: 0,
          activeBuffs: [],
          connected: p.connected,
          isHost: p.isHost,
        }));

        const freshGameState = {
          phase: 'roll',
          players: freshPlayers,
          activePlayerIndex: 0,
          roundNumber: 1,
          dice: [1, 1],
          isRolling: false,
          pendingEvent: null,
          lastRollSum: 2,
          winner: null,
          lastEventMessage: 'Új játék indult! Visszavágó kezdetét vette.',
        };

        room.gameStarted = true;
        room.gameState = freshGameState;
        room.lastActive = Date.now();

        console.log(`[Rematch Triggered] Room ${normalizedCode} reset and started fresh!`);
        io.to(normalizedCode).emit('room:game_reset', {
          roomCode: normalizedCode,
          room,
          gameState: freshGameState,
        });
      }
    } catch (err) {
      console.error('[room:rematch_vote error]', err);
    }
  });

  // 8. Clean Room Leave
  socket.on('room:leave', ({ roomCode }) => {
    try {
      const normalizedCode = roomCode?.trim().toUpperCase();
      const room = rooms.get(normalizedCode);
      if (!room) return;

      const playerIndex = room.players.findIndex((p) => p.socketId === socket.id);
      if (playerIndex !== -1) {
        const leavingPlayer = room.players[playerIndex];
        socket.leave(normalizedCode);
        currentRoomCode = null;

        if (!room.gameStarted) {
          room.players.splice(playerIndex, 1);
          if (leavingPlayer.isHost && room.players.length > 0) {
            room.players[0].isHost = true;
            room.hostSocketId = room.players[0].socketId;
          }
          if (room.players.length === 0) {
            rooms.delete(normalizedCode);
          } else {
            io.to(normalizedCode).emit('room:update', { room });
          }
        } else {
          leavingPlayer.connected = false;
          io.to(normalizedCode).emit('player:disconnected', {
            playerId: leavingPlayer.id,
            playerName: leavingPlayer.name,
            reason: 'left',
          });
        }
      }
    } catch (err) {
      console.error('[room:leave error]', err);
    }
  });

  // 9. Handle disconnect with Turn Timeout Watchdog
  socket.on('disconnect', () => {
    console.log(`[Socket] Client disconnected: ${socket.id}`);
    socketMessageCounts.delete(socket.id);

    if (currentRoomCode) {
      const room = rooms.get(currentRoomCode);
      if (room) {
        const playerIndex = room.players.findIndex((p) => p.socketId === socket.id);
        if (playerIndex !== -1) {
          const leavingPlayer = room.players[playerIndex];

          if (!room.gameStarted) {
            // In lobby: remove player entirely
            room.players.splice(playerIndex, 1);

            // Reassign host if host left
            if (leavingPlayer.isHost && room.players.length > 0) {
              room.players[0].isHost = true;
              room.hostSocketId = room.players[0].socketId;
            }

            // Cleanup if empty
            if (room.players.length === 0) {
              rooms.delete(currentRoomCode);
              console.log(`[Room Deleted] ${currentRoomCode} is empty.`);
            } else {
              io.to(currentRoomCode).emit('room:update', { room });
            }
          } else {
            // In active game: preserve state and allow reconnection
            leavingPlayer.connected = false;
            room.lastActive = Date.now();

            const isActivePlayer =
              room.gameState &&
              room.gameState.activePlayerIndex === playerIndex;

            if (isActivePlayer) {
              if (room.disconnectTimer) {
                clearTimeout(room.disconnectTimer);
              }
              const timeoutSeconds = 30;
              io.to(currentRoomCode).emit('player:disconnected', {
                playerId: leavingPlayer.id,
                playerName: leavingPlayer.name,
                timeoutSeconds,
                isActivePlayer: true,
              });

              room.disconnectTimer = setTimeout(() => {
                const activeRoom = rooms.get(currentRoomCode);
                if (
                  activeRoom &&
                  activeRoom.gameState &&
                  activeRoom.gameState.activePlayerIndex === playerIndex &&
                  !leavingPlayer.connected
                ) {
                  // Auto-pass turn to next player
                  activeRoom.gameState.activePlayerIndex =
                    (activeRoom.gameState.activePlayerIndex + 1) %
                    activeRoom.players.length;
                  activeRoom.gameState.phase = 'roll';
                  activeRoom.gameState.isRolling = false;
                  activeRoom.gameState.pendingEvent = null;
                  activeRoom.gameState.lastEventMessage = `${leavingPlayer.name} távolléte miatt a kör automatikusan átadásra került.`;

                  console.log(
                    `[Turn Auto-Passed] Room ${currentRoomCode} advanced turn due to timeout of ${leavingPlayer.name}`
                  );
                  io.to(currentRoomCode).emit('game:sync_broadcast', {
                    gameState: activeRoom.gameState,
                  });
                  io.to(currentRoomCode).emit('turn:auto_passed', {
                    newActivePlayerIndex: activeRoom.gameState.activePlayerIndex,
                    gameState: activeRoom.gameState,
                  });
                }
              }, timeoutSeconds * 1000);
            } else {
              io.to(currentRoomCode).emit('player:disconnected', {
                playerId: leavingPlayer.id,
                playerName: leavingPlayer.name,
                isActivePlayer: false,
              });
            }
          }
        }
      }
    }
  });
});

// Process-level Crash Guards
process.on('uncaughtException', (err) => {
  console.error('[Uncaught Exception]', err);
});
process.on('unhandledRejection', (reason) => {
  console.error('[Unhandled Rejection]', reason);
});

httpServer.listen(PORT, () => {
  console.log(`===============================================`);
  console.log(`🏥 CodeBlue Multiplayer Server running on :${PORT}`);
  console.log(`🌐 Ready for real-time WebSocket connections!`);
  console.log(`===============================================`);
});
