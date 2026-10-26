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
app.use(express.json());
app.use(express.static(publicPath));

// In-memory room storage
// Key: roomCode (e.g. "CB-4821"), Value: Room object
const rooms = new Map();

// Helper to generate a 4-digit readable room code
function generateRoomCode() {
  const digits = Math.floor(1000 + Math.random() * 9000);
  const code = `CB-${digits}`;
  return rooms.has(code) ? generateRoomCode() : code;
}

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    service: 'codeblue-multiplayer',
    activeRooms: rooms.size,
    timestamp: new Date().toISOString(),
  });
});

app.get('/rooms', (req, res) => {
  const publicRooms = Array.from(rooms.values()).map((r) => ({
    code: r.code,
    playerCount: r.players.length,
    gameStarted: r.gameStarted,
    createdAt: r.createdAt,
  }));
  res.json({ rooms: publicRooms });
});

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
});

io.on('connection', (socket) => {
  console.log(`[Socket] Client connected: ${socket.id}`);

  // Current room of this socket
  let currentRoomCode = null;

  // 1. Create a new room (Host)
  socket.on('room:create', ({ playerName, avatarId, color }, callback) => {
    try {
      const roomCode = generateRoomCode();
      const hostPlayer = {
        socketId: socket.id,
        id: 'p1',
        name: playerName?.trim() || '1. Orvos',
        avatar: avatarId || 'surgeon',
        avatarTitle: 'Dr. Sebész',
        color: color || '#00b4d8',
        isHost: true,
        connected: true,
      };

      const room = {
        code: roomCode,
        hostSocketId: socket.id,
        players: [hostPlayer],
        gameStarted: false,
        gameState: null,
        createdAt: new Date().toISOString(),
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
      const normalizedCode = roomCode?.trim().toUpperCase();
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
      const avatarTaken = room.players.some((p) => p.avatar === avatarId);
      let chosenAvatar = avatarId;
      if (avatarTaken) {
        // Fallback to first available avatar
        const allAvatars = ['surgeon', 'diagnostician', 'chief_physician', 'resident'];
        const takenAvatars = new Set(room.players.map((p) => p.avatar));
        const available = allAvatars.find((a) => !takenAvatars.has(a));
        if (available) {
          chosenAvatar = available;
        }
      }

      const playerIndex = room.players.length + 1;
      const newPlayer = {
        socketId: socket.id,
        id: `p${playerIndex}`,
        name: playerName?.trim() || `${playerIndex}. Orvos`,
        avatar: chosenAvatar,
        avatarTitle: `Dr. ${chosenAvatar}`,
        color: color || '#38bdf8',
        isHost: false,
        connected: true,
      };

      room.players.push(newPlayer);
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
      const room = rooms.get(roomCode);
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

      console.log(`[Game Started] Room ${roomCode} with ${room.players.length} players!`);

      io.to(roomCode).emit('game:started', {
        roomCode,
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
      const room = rooms.get(roomCode);
      if (!room) return;

      // Update server-side snapshot if provided
      if (newGameState) {
        room.gameState = newGameState;
      }

      // Broadcast action to all other peers in the room
      socket.to(roomCode).emit('game:action_broadcast', {
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
      const room = rooms.get(roomCode);
      if (!room) return;
      room.gameState = gameState;
      socket.to(roomCode).emit('game:sync_broadcast', { gameState });
    } catch (err) {
      console.error('[game:sync error]', err);
    }
  });

  // 6. Handle disconnect
  socket.on('disconnect', () => {
    console.log(`[Socket] Client disconnected: ${socket.id}`);

    if (currentRoomCode) {
      const room = rooms.get(currentRoomCode);
      if (room) {
        const playerIndex = room.players.findIndex((p) => p.socketId === socket.id);
        if (playerIndex !== -1) {
          const leavingPlayer = room.players[playerIndex];

          if (!room.gameStarted) {
            // If lobby, remove player entirely
            room.players.splice(playerIndex, 1);

            // If host left and others remain, assign new host
            if (leavingPlayer.isHost && room.players.length > 0) {
              room.players[0].isHost = true;
              room.hostSocketId = room.players[0].socketId;
            }

            // If empty, clean up room
            if (room.players.length === 0) {
              rooms.delete(currentRoomCode);
              console.log(`[Room Deleted] ${currentRoomCode} is empty.`);
            } else {
              io.to(currentRoomCode).emit('room:update', { room });
            }
          } else {
            // If game is active, mark disconnected so they can reconnect
            leavingPlayer.connected = false;
            io.to(currentRoomCode).emit('player:disconnected', {
              playerId: leavingPlayer.id,
              playerName: leavingPlayer.name,
            });
          }
        }
      }
    }
  });
});

httpServer.listen(PORT, () => {
  console.log(`===============================================`);
  console.log(`🏥 CodeBlue Multiplayer Server running on :${PORT}`);
  console.log(`🌐 Ready for real-time WebSocket connections!`);
  console.log(`===============================================`);
});
