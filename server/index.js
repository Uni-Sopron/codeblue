import express from 'express';
import { createServer } from 'node:http';
import { createHash, randomBytes, randomInt, timingSafeEqual } from 'node:crypto';
import { Server } from 'socket.io';
import cors from 'cors';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { addBotToRoom, removeBotFromRoom, canDriveActivePlayer, hasValidRoster, transferHostToHuman } from './botPlayers.js';

const filename = fileURLToPath(import.meta.url);
const publicPath = path.join(path.dirname(filename), 'public');
const AVATARS = ['surgeon', 'diagnostician', 'chief_physician', 'resident'];
const TITLES = { surgeon: 'Dr. Sebész', diagnostician: 'Dr. Diagnoszta', chief_physician: 'Dr. Főorvos', resident: 'Dr. Rezidens' };
const DIRECTORY = 'public-room-directory';

export function sanitizeName(value, fallback = 'Orvos', maxLength = 32) {
  if (typeof value !== 'string') return fallback.slice(0, maxLength);
  const clean = value.replace(/<[^>]*>?/gm, '').replace(/[<>\u0000-\u001f\u007f]/g, '').trim();
  return (clean || fallback).slice(0, maxLength);
}
export const isValidRoomCode = (code) => typeof code === 'string' && /^CB-\d{4}$/.test(code.trim().toUpperCase());
export const sanitizeAvatar = (avatar) => AVATARS.includes(avatar) ? avatar : AVATARS[0];
export const sanitizeColor = (color, fallback = '#00b4d8') => typeof color === 'string' && /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(color) ? color : fallback;
const hash = (value, salt = '') => createHash('sha256').update(salt).update(value).digest();
const safeEqual = (a, b) => Buffer.isBuffer(a) && Buffer.isBuffer(b) && a.length === b.length && timingSafeEqual(a, b);

export function createInitialGameState(players) {
  const cardDeck = Array.from({ length: 40 }, (_, i) => i + 1);
  for (let i = cardDeck.length - 1; i > 0; i--) {
    const j = randomInt(i + 1);
    [cardDeck[i], cardDeck[j]] = [cardDeck[j], cardDeck[i]];
  }
  return {
    players: players.map((p) => ({
      id: p.id, name: p.name, color: p.color, avatar: p.avatar, avatarTitle: p.avatarTitle,
      cash: 1_500_000, debt: 0, position: 0, builtElements: [], skipTurns: 0, activeBuffs: [],
      bank: { savings: 0, clinicalBond: 0, biotechEquity: 0 }, connected: p.connected, isHost: p.isHost,
      ...(p.isAI ? { isAI: true } : {}),
    })),
    activePlayerIndex: 0, turnNumber: 1, phase: 'roll', diceResult: null, isRolling: false,
    drawnCard: null, cardDeck, discardDeck: [], winner: null, logs: [], roundPassBonusGranted: false, builtThisTurn: false,
  };
}

export function createGameServer({ now = Date.now, disconnectTimeoutMs = 30_000, roomTtlMs = 3 * 60 * 60 * 1000 } = {}) {
  const app = express();
  app.use(cors({ origin: '*' }));
  app.use(express.json({ limit: '256kb' }));
  app.use(express.static(publicPath));
  const httpServer = createServer(app);
  const io = new Server(httpServer, { cors: { origin: '*', methods: ['GET', 'POST'] }, pingTimeout: 30_000, pingInterval: 10_000, maxHttpBufferSize: 512 * 1024 });
  const rooms = new Map();
  const secrets = new Map();
  const messageCounts = new Map();

  const roomView = (room) => ({
    code: room.code, name: room.name, visibility: room.visibility, hasPin: room.hasPin,
    hostSocketId: room.hostSocketId, players: room.players.map((p) => ({
      socketId: p.socketId, id: p.id, name: p.name, avatar: p.avatar, avatarTitle: p.avatarTitle,
      color: p.color, isHost: p.isHost, connected: p.connected, ...(p.isAI ? { isAI: true } : {}),
    })),
    gameStarted: room.gameStarted, gameState: room.gameState, createdAt: room.createdAt,
    rematchVotes: { ...room.rematchVotes },
  });
  const publicRooms = () => Array.from(rooms.values()).filter((r) => r.visibility === 'public').map((room) => {
    const host = room.players.find((p) => p.isHost) || room.players[0];
    return { code: room.code, name: room.name, hostName: host.name, hostAvatar: host.avatar,
      playerCount: room.players.length, maxPlayers: 4, gameStarted: room.gameStarted, hasPin: room.hasPin };
  });
  const publishDirectory = () => io.to(DIRECTORY).emit('rooms:update', { rooms: publicRooms() });
  const publishRoom = (room) => io.to(room.code).emit('room:update', { room: roomView(room) });
  const clearWatchdog = (room) => { if (room.disconnectTimer) clearTimeout(room.disconnectTimer); room.disconnectTimer = null; };
  const deleteRoom = (code) => { const room = rooms.get(code); if (room) clearWatchdog(room); rooms.delete(code); secrets.delete(code); };
  const limited = (socketId) => {
    const stamp = now();
    let entry = messageCounts.get(socketId);
    if (!entry || stamp >= entry.resetAt) entry = { count: 0, resetAt: stamp + 1000 };
    entry.count++;
    messageCounts.set(socketId, entry);
    return entry.count > 40;
  };
  const transferHost = transferHostToHuman;
  const scheduleWatchdog = (room) => {
    clearWatchdog(room);
    const state = room.gameState;
    const active = state && room.players.find((p) => p.id === state.players[state.activePlayerIndex]?.id);
    if (!room.gameStarted || !active || active.connected || state.winner) return;
    room.disconnectTimer = setTimeout(() => {
      room.disconnectTimer = null;
      if (!rooms.has(room.code) || active.connected || room.gameState?.players[room.gameState.activePlayerIndex]?.id !== active.id) return;
      let next = -1;
      for (let offset = 1; offset < room.gameState.players.length; offset++) {
        const index = (room.gameState.activePlayerIndex + offset) % room.gameState.players.length;
        if (room.players.some((p) => p.id === room.gameState.players[index].id && p.connected)) { next = index; break; }
      }
      if (next === -1) return;
      const previousIndex = room.gameState.activePlayerIndex;
      room.gameState = { ...room.gameState, activePlayerIndex: next, phase: 'roll', diceResult: null, isRolling: false, drawnCard: null,
        roundPassBonusGranted: false, builtThisTurn: false, turnNumber: room.gameState.turnNumber + (next <= previousIndex ? 1 : 0) };
      io.to(room.code).emit('game:sync_broadcast', { gameState: room.gameState });
      io.to(room.code).emit('turn:auto_passed', { newActivePlayerIndex: next, gameState: room.gameState });
    }, disconnectTimeoutMs);
    room.disconnectTimer.unref?.();
  };

  const gc = setInterval(() => {
    let changed = false;
    for (const [code, room] of rooms) if (now() - room.lastActive > roomTtlMs) { deleteRoom(code); changed = true; }
    if (changed) publishDirectory();
  }, 30 * 60 * 1000);
  gc.unref();
  app.get('/health', (_req, res) => res.json({ status: 'ok', service: 'codeblue-multiplayer', activeRooms: rooms.size, timestamp: new Date(now()).toISOString() }));
  app.get('/rooms', (_req, res) => res.json({ rooms: publicRooms() }));
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/socket.io')) return next();
    res.sendFile(path.join(publicPath, 'index.html'), (error) => { if (error) next(); });
  });

  io.on('connection', (socket) => {
    let currentRoomCode = null;
    let wrongPins = 0;
    let pinLockedUntil = 0;
    const fail = (callback, error, errorCode = 'ROOM_ERROR', extra = {}) => {
      const response = { success: false, error, errorCode, ...extra };
      if (typeof callback === 'function') callback(response);
      socket.emit('room:error', response);
    };
    const checkRate = (callback) => { if (!limited(socket.id)) return true; fail(callback, 'Túl sok kérés. Próbáld újra rövidesen.', 'RATE_LIMITED'); return false; };
    const memberRoom = (code) => {
      if (!isValidRoomCode(code)) return null;
      const room = rooms.get(code.trim().toUpperCase());
      return room && currentRoomCode === room.code && room.players.some((p) => p.socketId === socket.id && p.connected) ? room : null;
    };
    const alreadyJoined = () => !!(currentRoomCode && memberRoom(currentRoomCode));
    const issueToken = (room, player) => {
      const token = randomBytes(32).toString('hex');
      secrets.get(room.code).tokens.set(player.id, hash(token));
      return token;
    };
    const success = (room, player, callback, event) => {
      const response = { success: true, roomCode: room.code, room: roomView(room), player: roomView(room).players.find((p) => p.id === player.id), reconnectToken: issueToken(room, player) };
      if (typeof callback === 'function') callback(response);
      if (event) socket.emit(event, { success: true, roomCode: room.code, room: response.room, player: response.player });
    };

    socket.on('rooms:subscribe', (callback) => {
      if (!checkRate(typeof callback === 'function' ? callback : undefined)) return;
      socket.join(DIRECTORY);
      const payload = { rooms: publicRooms() };
      socket.emit('rooms:list', payload);
      if (typeof callback === 'function') callback({ success: true, ...payload });
    });
    socket.on('rooms:unsubscribe', () => socket.leave(DIRECTORY));

    socket.on('room:create', (data = {}, callback) => {
      if (!checkRate(callback)) return;
      if (alreadyJoined()) return fail(callback, 'Előbb hagyd el a jelenlegi szobát.', 'ALREADY_IN_ROOM');
      const { playerName, avatarId, color, name, visibility = 'public', pin = '' } = data || {};
      if (visibility !== 'public' && visibility !== 'private') return fail(callback, 'Érvénytelen láthatóság.', 'INVALID_VISIBILITY');
      if (typeof pin !== 'string' || (pin !== '' && !/^\d{4}$/.test(pin))) return fail(callback, 'A PIN pontosan 4 számjegy legyen.', 'INVALID_PIN');
      if (rooms.size >= 9000) return fail(callback, 'A szerver megtelt.', 'SERVER_FULL');
      let code;
      do { code = `CB-${randomInt(1000, 10000)}`; } while (rooms.has(code));
      const hostName = sanitizeName(playerName, '1. Orvos');
      const avatar = sanitizeAvatar(avatarId);
      const player = { socketId: socket.id, id: 'p1', name: hostName, avatar, avatarTitle: TITLES[avatar], color: sanitizeColor(color), isHost: true, connected: true };
      const room = { code, name: sanitizeName(name, `${hostName} Klinikája`, 24), visibility, hasPin: pin !== '', hostSocketId: socket.id,
        players: [player], gameStarted: false, gameState: null, rematchVotes: {}, disconnectTimer: null, createdAt: new Date(now()).toISOString(), lastActive: now() };
      const salt = randomBytes(16).toString('hex');
      secrets.set(code, { salt, pinHash: pin ? hash(pin, salt) : null, tokens: new Map() });
      rooms.set(code, room);
      socket.join(code);
      currentRoomCode = code;
      success(room, player, callback, 'room:created');
      publishDirectory();
    });

    socket.on('room:join', (data = {}, callback) => {
      if (!checkRate(callback)) return;
      if (alreadyJoined()) return fail(callback, 'Előbb hagyd el a jelenlegi szobát.', 'ALREADY_IN_ROOM');
      const { roomCode, playerName, avatarId, color, pin } = data || {};
      if (pinLockedUntil > now()) return fail(callback, 'Túl sok hibás PIN. Várj egy percet.', 'PIN_LOCKED', { retryAfterSeconds: Math.ceil((pinLockedUntil - now()) / 1000) });
      if (pinLockedUntil) { wrongPins = 0; pinLockedUntil = 0; }
      if (!isValidRoomCode(roomCode)) return fail(callback, 'Érvénytelen szobakód! (Példa: CB-4821)', 'INVALID_ROOM_CODE');
      const room = rooms.get(roomCode.trim().toUpperCase());
      if (!room) return fail(callback, 'A szoba nem található.', 'ROOM_NOT_FOUND');
      if (room.gameStarted) return fail(callback, 'A játék ebben a szobában már elkezdődött.', 'GAME_STARTED');
      if (room.players.length >= 4) return fail(callback, 'A szoba megtelt.', 'ROOM_FULL');
      const secret = secrets.get(room.code);
      if (room.hasPin) {
        if (pin === undefined || pin === '') return fail(callback, 'Add meg a szoba 4 jegyű PIN-kódját.', 'PIN_REQUIRED');
        if (typeof pin !== 'string' || !safeEqual(hash(pin, secret.salt), secret.pinHash)) {
          wrongPins++;
          if (wrongPins >= 5) { pinLockedUntil = now() + 60_000; return fail(callback, 'Öt hibás PIN után a belépés 60 másodpercig zárolva.', 'PIN_LOCKED', { retryAfterSeconds: 60 }); }
          return fail(callback, 'Hibás PIN-kód.', 'PIN_INVALID');
        }
      }
      wrongPins = 0;
      const id = ['p1', 'p2', 'p3', 'p4'].find((candidate) => !room.players.some((p) => p.id === candidate));
      let avatar = sanitizeAvatar(avatarId);
      if (room.players.some((p) => p.avatar === avatar)) avatar = AVATARS.find((candidate) => !room.players.some((p) => p.avatar === candidate));
      const player = { socketId: socket.id, id, name: sanitizeName(playerName, `${id.slice(1)}. Orvos`), avatar, avatarTitle: TITLES[avatar], color: sanitizeColor(color, '#38bdf8'), isHost: false, connected: true };
      room.players.push(player);
      room.lastActive = now();
      socket.join(room.code);
      currentRoomCode = room.code;
      success(room, player, callback, 'room:joined');
      publishRoom(room);
      publishDirectory();
    });

    const manageBot = (data, callback, remove) => {
      if (!checkRate(callback)) return;
      const room = memberRoom(data?.roomCode);
      if (!room || room.hostSocketId !== socket.id) return fail(callback, 'Csak a szobagazda kezelheti a botokat.', 'HOST_REQUIRED');
      const result = remove ? removeBotFromRoom(room, socket.id, data?.playerId) : addBotToRoom(room, socket.id);
      if (!result.success) return fail(callback, result.error, room.gameStarted ? 'GAME_STARTED' : room.players.length >= 4 ? 'ROOM_FULL' : 'BOT_ERROR');
      room.lastActive = now();
      if (typeof callback === 'function') callback({ success: true, room: roomView(room) });
      publishRoom(room);
      publishDirectory();
    };
    socket.on('room:add_bot', (data = {}, callback) => manageBot(data, callback, false));
    socket.on('room:remove_bot', (data = {}, callback) => manageBot(data, callback, true));

    socket.on('room:start', (data = {}, callback) => {
      if (!checkRate(callback)) return;
      const room = memberRoom(data?.roomCode);
      if (!room || room.hostSocketId !== socket.id) return fail(callback, 'Csak a szobagazda indíthatja a játékot.', 'HOST_REQUIRED');
      if (room.gameStarted) return fail(callback, 'A játék már elkezdődött.', 'GAME_STARTED');
      if (room.players.length < 2) return fail(callback, 'Legalább 2 orvos szükséges.', 'NOT_ENOUGH_PLAYERS');
      room.gameStarted = true;
      room.gameState = createInitialGameState(room.players);
      room.lastActive = now();
      io.to(room.code).emit('game:started', { roomCode: room.code, room: roomView(room), gameState: room.gameState });
      if (typeof callback === 'function') callback({ success: true });
      publishDirectory();
    });

    const acceptsState = (room, state) => canDriveActivePlayer(room, socket.id) && hasValidRoster(room, state);
    socket.on('game:action', (data = {}) => {
      if (!checkRate()) return;
      const room = memberRoom(data?.roomCode);
      if (!room || !acceptsState(room, data.newGameState)) return;
      room.gameState = data.newGameState;
      room.lastActive = now();
      socket.to(room.code).emit('game:action_broadcast', { actionType: data.actionType, payload: data.payload, newGameState: room.gameState, senderSocketId: socket.id });
      scheduleWatchdog(room);
    });
    socket.on('game:sync', (data = {}) => {
      if (!checkRate()) return;
      const room = memberRoom(data?.roomCode);
      if (!room || !acceptsState(room, data.gameState)) return;
      room.gameState = data.gameState;
      room.lastActive = now();
      socket.to(room.code).emit('game:sync_broadcast', { gameState: room.gameState });
      scheduleWatchdog(room);
    });

    socket.on('room:reconnect', (data = {}, callback) => {
      if (!checkRate(callback)) return;
      const { roomCode, playerId, reconnectToken } = data || {};
      if (alreadyJoined()) return fail(callback, 'Már csatlakoztál egy szobához.', 'ALREADY_IN_ROOM');
      const room = isValidRoomCode(roomCode) && rooms.get(roomCode.trim().toUpperCase());
      const player = room && room.players.find((p) => p.id === playerId && !p.isAI);
      const expected = room && secrets.get(room.code)?.tokens.get(playerId);
      if (!player || typeof reconnectToken !== 'string' || !safeEqual(hash(reconnectToken), expected)) return fail(callback, 'A visszacsatlakozási azonosító érvénytelen.', 'INVALID_RECONNECT');
      if (player.connected) return fail(callback, 'A játékos már csatlakozva van.', 'PLAYER_CONNECTED');
      player.socketId = socket.id;
      player.connected = true;
      socket.join(room.code);
      currentRoomCode = room.code;
      room.lastActive = now();
      const previousHost = room.hostSocketId;
      transferHost(room);
      if (room.gameState) room.gameState = { ...room.gameState, players: room.gameState.players.map((p) => p.id === player.id ? { ...p, connected: true } : p) };
      scheduleWatchdog(room);
      const token = issueToken(room, player);
      if (typeof callback === 'function') callback({ success: true, room: roomView(room), player: roomView(room).players.find((p) => p.id === player.id), gameState: room.gameState, reconnectToken: token });
      if (room.gameState) {
        if (previousHost !== room.hostSocketId) io.to(room.code).emit('game:sync_broadcast', { gameState: room.gameState });
        else socket.emit('game:sync_broadcast', { gameState: room.gameState });
      }
      io.to(room.code).emit('player:reconnected', { playerId: player.id, playerName: player.name });
      publishRoom(room);
      publishDirectory();
    });

    socket.on('room:rematch_vote', (data = {}) => {
      if (!checkRate()) return;
      const room = memberRoom(data?.roomCode);
      if (!room?.gameStarted) return;
      const player = room.players.find((p) => p.socketId === socket.id);
      if (data.ready !== true) {
        room.rematchVotes = {};
        io.to(room.code).emit('room:rematch_cancelled', { cancelledBy: player.name, cancelledById: player.id });
        io.to(room.code).emit('room:rematch_update', { votes: {}, requestedBy: player.name, requestedById: player.id, isHost: player.isHost, ready: false });
        return;
      }
      room.rematchVotes[player.id] = true;
      for (const bot of room.players.filter((p) => p.isAI)) room.rematchVotes[bot.id] = true;
      room.lastActive = now();
      io.to(room.code).emit('room:rematch_update', { votes: { ...room.rematchVotes }, requestedBy: player.name, requestedById: player.id, isHost: player.isHost, ready: true });
      const connected = room.players.filter((p) => p.connected && !p.isAI);
      if (room.players.length >= 2 && connected.length >= 1 && connected.every((p) => room.rematchVotes[p.id] === true)) {
        room.rematchVotes = {};
        clearWatchdog(room);
        room.gameState = createInitialGameState(room.players);
        io.to(room.code).emit('room:game_reset', { roomCode: room.code, room: roomView(room), gameState: room.gameState });
        scheduleWatchdog(room);
      }
    });

    const leave = (explicit) => {
      const room = currentRoomCode && rooms.get(currentRoomCode);
      currentRoomCode = null;
      if (!room) return;
      const index = room.players.findIndex((p) => p.socketId === socket.id);
      if (index < 0) return;
      const player = room.players[index];
      socket.leave(room.code);
      room.lastActive = now();
      if (!room.gameStarted) {
        room.players.splice(index, 1);
        secrets.get(room.code).tokens.delete(player.id);
        transferHost(room);
        if (!room.players.some((p) => !p.isAI)) deleteRoom(room.code);
        else publishRoom(room);
      } else {
        player.connected = false;
        const previousHost = room.hostSocketId;
        if (explicit) secrets.get(room.code).tokens.delete(player.id);
        transferHost(room);
        room.gameState = { ...room.gameState, players: room.gameState.players.map((p) => ({ ...p, connected: room.players.find((rp) => rp.id === p.id)?.connected ?? false, isHost: room.players.find((rp) => rp.id === p.id)?.isHost ?? false })) };
        const active = room.gameState.players[room.gameState.activePlayerIndex]?.id === player.id;
        io.to(room.code).emit('player:disconnected', { playerId: player.id, playerName: player.name, ...(explicit ? { reason: 'left' } : {}), isActivePlayer: active, ...(active ? { timeoutSeconds: Math.ceil(disconnectTimeoutMs / 1000) } : {}) });
        if (explicit) io.to(room.code).emit('room:player_left', { playerId: player.id, playerName: player.name });
        publishRoom(room);
        if (previousHost !== room.hostSocketId) io.to(room.code).emit('game:sync_broadcast', { gameState: room.gameState });
        scheduleWatchdog(room);
      }
      publishDirectory();
    };
    socket.on('room:leave', (data = {}, callback) => {
      if (!memberRoom(data?.roomCode)) return fail(callback, 'Nem vagy ennek a szobának a tagja.', 'NOT_A_MEMBER');
      leave(true);
      if (typeof callback === 'function') callback({ success: true });
    });
    socket.on('disconnect', () => { messageCounts.delete(socket.id); leave(false); });
  });

  return { app, httpServer, io,
    close: async () => { clearInterval(gc); for (const room of rooms.values()) clearWatchdog(room); await new Promise((resolve) => io.close(resolve)); },
  };
}

if (process.argv[1] && path.resolve(process.argv[1]) === filename) {
  const server = createGameServer();
  const port = process.env.PORT || 3001;
  server.httpServer.listen(port, () => console.log(`CodeBlue Multiplayer Server running on :${port}`));
}
