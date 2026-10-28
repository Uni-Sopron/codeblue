import test, { type TestContext } from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { readFile } from 'node:fs/promises';
import { io, type Socket } from 'socket.io-client';
import type { GameState } from '../src/types/game.ts';
import { createGameServer } from '../server/index.js';

interface RoomPlayer { id: string; socketId: string; name: string; isAI?: boolean; isHost: boolean; connected: boolean }
interface Room { code: string; players: RoomPlayer[]; hostSocketId: string; gameState: GameState }
interface Reply { success: boolean; roomCode: string; room: Room; player: RoomPlayer; reconnectToken?: string; errorCode?: string }
const human = { playerName: 'Dr. Ember', avatarId: 'surgeon', color: '#0284c7' };
const request = (socket: Socket, name: string, payload: unknown = {}): Promise<Reply> => new Promise((resolve, reject) => {
  socket.timeout(1500).emit(name, payload, (error: Error | null, response: Reply) => error ? reject(error) : resolve(response));
});
function event<T>(socket: Socket, name: string, matches: (payload: T) => boolean = () => true): Promise<T> {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => { socket.off(name, handler); reject(new Error(`Missing event: ${name}`)); }, 1500);
    const handler = (payload: T) => { if (!matches(payload)) return; clearTimeout(timeout); socket.off(name, handler); resolve(payload); };
    socket.on(name, handler);
  });
}
async function setup(t: TestContext, options: Parameters<typeof createGameServer>[0] = {}) {
  const server = createGameServer(options);
  const sockets: Socket[] = [];
  server.httpServer.listen(0, '127.0.0.1');
  await once(server.httpServer, 'listening');
  const address = server.httpServer.address();
  assert(address && typeof address !== 'string');
  const url = `http://127.0.0.1:${address.port}`;
  t.after(async () => { sockets.forEach((socket) => socket.disconnect()); await server.close(); });
  const connect = async () => {
    const socket = io(url, { forceNew: true, reconnection: false, transports: ['websocket'] });
    sockets.push(socket);
    await once(socket, 'connect');
    return socket;
  };
  return { connect, url };
}
async function start(socket: Socket, code: string): Promise<GameState> {
  const started = event<{ gameState: GameState }>(socket, 'game:started');
  assert((await request(socket, 'room:start', { roomCode: code })).success);
  return (await started).gameState;
}
async function sync(sender: Socket, receiver: Socket, code: string, state: GameState): Promise<GameState> {
  const broadcast = event<{ gameState: GameState }>(receiver, 'game:sync_broadcast');
  sender.emit('game:sync', { roomCode: code, gameState: state });
  return (await broadcast).gameState;
}
async function rejected(receiver: Socket, emit: () => void): Promise<void> {
  const broadcasts: string[] = [];
  const onSync = () => broadcasts.push('sync');
  const onAction = () => broadcasts.push('action');
  receiver.on('game:sync_broadcast', onSync);
  receiver.on('game:action_broadcast', onAction);
  emit();
  await new Promise((resolve) => setTimeout(resolve, 50));
  receiver.off('game:sync_broadcast', onSync);
  receiver.off('game:action_broadcast', onAction);
  assert.deepEqual(broadcasts, []);
}

test('Only the host can add/remove virtual players; room and directory pushes reflect occupancy', async (t) => {
  const { connect } = await setup(t);
  const host = await connect(); const guest = await connect(); const browser = await connect();
  const room = await request(host, 'room:create', human);
  await request(guest, 'room:join', { ...human, roomCode: room.roomCode });
  const initialList = event(browser, 'rooms:list');
  browser.emit('rooms:subscribe'); await initialList;
  assert.equal((await request(guest, 'room:add_bot', { roomCode: room.roomCode })).errorCode, 'HOST_REQUIRED');
  const updated = event<{ room: Room }>(guest, 'room:update', (value) => value.room.players.length === 3);
  const directory = event<{ rooms: Array<{ code: string; playerCount: number }> }>(browser, 'rooms:update');
  const added = await request(host, 'room:add_bot', { roomCode: room.roomCode });
  assert(added.success);
  assert.equal(added.player, undefined);
  const bot = added.room.players.find((player) => player.isAI)!;
  assert(bot.socketId.startsWith('bot:'));
  assert.equal(bot.isHost, false);
  assert.equal((await updated).room.players[2].id, bot.id);
  assert.equal((await directory).rooms.find((value) => value.code === room.roomCode)?.playerCount, 3);
  assert.equal((await request(guest, 'room:remove_bot', { roomCode: room.roomCode, playerId: bot.id })).errorCode, 'HOST_REQUIRED');
  assert.equal((await request(host, 'room:remove_bot', { roomCode: room.roomCode, playerId: 'p2' })).success, false);
  assert((await request(host, 'room:add_bot', { roomCode: room.roomCode })).success);
  assert.equal((await request(host, 'room:add_bot', { roomCode: room.roomCode })).errorCode, 'ROOM_FULL');
  assert((await request(host, 'room:remove_bot', { roomCode: room.roomCode, playerId: bot.id })).success);
  const replacement = await request(host, 'room:add_bot', { roomCode: room.roomCode });
  assert.deepEqual(replacement.room.players.map((player) => player.id), ['p1', 'p2', 'p4', 'p3']);
  assert.equal(replacement.room.players.find((player) => player.id === 'p2')?.isAI, undefined);
});

test('One human can start and rematch with three bots without any bot sockets or votes', async (t) => {
  const { connect } = await setup(t);
  const host = await connect();
  const room = await request(host, 'room:create', human);
  for (let i = 0; i < 3; i++) assert((await request(host, 'room:add_bot', { roomCode: room.roomCode })).success);
  const state = await start(host, room.roomCode);
  assert.equal(state.players.length, 4);
  assert.equal(state.players.filter((player) => player.isAI).length, 3);
  assert.equal(state.builtThisTurn, false);
  assert.equal(new Set(state.cardDeck).size, 40);
  assert.equal((await request(host, 'room:add_bot', { roomCode: room.roomCode })).errorCode, 'GAME_STARTED');
  assert.equal((await request(host, 'room:remove_bot', { roomCode: room.roomCode, playerId: 'p2' })).errorCode, 'GAME_STARTED');
  const reset = event<{ gameState: GameState; room: Room }>(host, 'room:game_reset');
  host.emit('room:rematch_vote', { roomCode: room.roomCode, ready: true });
  const next = await reset;
  assert.equal(next.gameState.builtThisTurn, false);
  assert.equal(next.gameState.turnNumber, 1);
  assert.equal(next.gameState.players.filter((player) => player.isAI).length, 3);
  assert.equal(next.room.hostSocketId, host.id);
});

test('Rematch auto-readies bots while waiting for every connected human', async (t) => {
  const { connect } = await setup(t);
  const host = await connect(); const guest = await connect();
  const room = await request(host, 'room:create', human);
  await request(guest, 'room:join', { ...human, roomCode: room.roomCode });
  await request(host, 'room:add_bot', { roomCode: room.roomCode });
  await start(host, room.roomCode);
  const votes = event<{ votes: Record<string, boolean> }>(guest, 'room:rematch_update');
  let resetCount = 0;
  host.on('room:game_reset', () => resetCount++);
  host.emit('room:rematch_vote', { roomCode: room.roomCode, ready: true });
  const current = (await votes).votes;
  assert.equal(current.p1, true);
  assert.equal(current.p3, true);
  assert.equal(current.p2, undefined);
  assert.equal(resetCount, 0);
  const reset = event<{ gameState: GameState }>(host, 'room:game_reset');
  guest.emit('room:rematch_vote', { roomCode: room.roomCode, ready: true });
  assert.equal((await reset).gameState.turnNumber, 1);
});

test('Authority follows the previous canonical active player: only its human or the bot host may drive state', async (t) => {
  const { connect } = await setup(t);
  const host = await connect(); const guest = await connect(); const outsider = await connect();
  const room = await request(host, 'room:create', human);
  await request(guest, 'room:join', { ...human, roomCode: room.roomCode });
  await request(host, 'room:add_bot', { roomCode: room.roomCode });
  let state = await start(host, room.roomCode);
  await rejected(host, () => guest.emit('game:sync', { roomCode: room.roomCode, gameState: { ...state, activePlayerIndex: 1 } }));
  state = await sync(host, guest, room.roomCode, { ...state, activePlayerIndex: 2 });
  await rejected(host, () => guest.emit('game:sync', { roomCode: room.roomCode, gameState: { ...state, phase: 'building' } }));
  await rejected(host, () => outsider.emit('game:sync', { roomCode: room.roomCode, gameState: { ...state, phase: 'building' } }));
  state = await sync(host, guest, room.roomCode, { ...state, phase: 'building' });
  const action = event<{ newGameState: GameState }>(guest, 'game:action_broadcast');
  host.emit('game:action', { roomCode: room.roomCode, actionType: 'end_turn', newGameState: { ...state, activePlayerIndex: 1, phase: 'roll' } });
  state = (await action).newGameState;
  await rejected(guest, () => host.emit('game:sync', { roomCode: room.roomCode, gameState: { ...state, phase: 'building' } }));
  state = await sync(guest, host, room.roomCode, { ...state, phase: 'building' });
  assert.equal(state.activePlayerIndex, 1);
  assert.equal(state.phase, 'building');
});

test('Even an authorized host cannot spoof bot flags, player IDs, roster order or membership count', async (t) => {
  const { connect } = await setup(t);
  const host = await connect(); const guest = await connect();
  const room = await request(host, 'room:create', human);
  await request(guest, 'room:join', { ...human, roomCode: room.roomCode });
  await request(host, 'room:add_bot', { roomCode: room.roomCode });
  const state = await start(host, room.roomCode);
  const changedBot = { ...state, players: state.players.map((player) => player.isAI ? { ...player, isAI: false } : player) };
  const changedHuman = { ...state, players: state.players.map((player, index) => index === 1 ? { ...player, isAI: true } : player) };
  const reversed = { ...state, players: [...state.players].reverse() };
  const missing = { ...state, players: state.players.slice(1) };
  for (const invalid of [changedBot, changedHuman, reversed, missing]) {
    await rejected(guest, () => {
      host.emit('game:sync', { roomCode: room.roomCode, gameState: invalid });
      host.emit('game:action', { roomCode: room.roomCode, newGameState: invalid });
    });
  }
  assert.equal((await sync(host, guest, room.roomCode, { ...state, phase: 'building' })).players.length, 3);
});

test('Host disconnect transfers bot authority to a human, releases a pending roll and preserves construction state', async (t) => {
  const { connect } = await setup(t);
  const host = await connect(); const guest = await connect();
  const room = await request(host, 'room:create', human);
  await request(guest, 'room:join', { ...human, roomCode: room.roomCode });
  await request(host, 'room:add_bot', { roomCode: room.roomCode });
  let state = await start(host, room.roomCode);
  state = await sync(host, guest, room.roomCode, { ...state, activePlayerIndex: 2, phase: 'roll', isRolling: true, builtThisTurn: true });
  const nextRoom = event<{ room: Room }>(guest, 'room:update', (value) => value.room.hostSocketId === guest.id);
  const recovered = event<{ gameState: GameState }>(guest, 'game:sync_broadcast');
  host.disconnect();
  const transferred = (await nextRoom).room;
  state = (await recovered).gameState;
  assert.equal(transferred.players.find((player) => player.isHost)?.id, 'p2');
  assert.equal(transferred.players.find((player) => player.isAI)?.isHost, false);
  assert.equal(state.isRolling, false);
  assert.equal(state.phase, 'roll');
  assert.equal(state.builtThisTurn, true);
  const returnedHost = await connect();
  const reconnected = await request(returnedHost, 'room:reconnect', { roomCode: room.roomCode, playerId: 'p1', reconnectToken: room.reconnectToken });
  assert(reconnected.success);
  assert.equal(reconnected.player.isHost, false);
  await rejected(guest, () => returnedHost.emit('game:sync', { roomCode: room.roomCode, gameState: { ...state, phase: 'building' } }));
  const driven = await sync(guest, returnedHost, room.roomCode, { ...state, phase: 'building' });
  assert.equal(driven.phase, 'building');
});

test('An empty-human lobby is deleted instead of promoting a bot', async (t) => {
  const { connect, url } = await setup(t);
  const host = await connect(); const outsider = await connect();
  const room = await request(host, 'room:create', human);
  await request(host, 'room:add_bot', { roomCode: room.roomCode });
  await request(host, 'room:leave', { roomCode: room.roomCode });
  const listing = await (await fetch(`${url}/rooms`)).json() as { rooms: { code: string }[] };
  assert(!listing.rooms.some((value) => value.code === room.roomCode));
  assert.equal((await request(outsider, 'room:join', { ...human, roomCode: room.roomCode })).errorCode, 'ROOM_NOT_FOUND');
});

test('A solo human may reconnect to a preserved bot game after disconnection', async (t) => {
  const { connect } = await setup(t);
  const host = await connect(); const observer = await connect();
  const room = await request(host, 'room:create', human);
  await request(host, 'room:add_bot', { roomCode: room.roomCode });
  const state = await start(host, room.roomCode);
  const changed = event(observer, 'rooms:update');
  observer.emit('rooms:subscribe');
  const list = event(observer, 'rooms:list'); await list;
  host.emit('game:sync', { roomCode: room.roomCode, gameState: { ...state, activePlayerIndex: 1, isRolling: true, builtThisTurn: true } });
  assert.equal((await request(host, 'room:start', { roomCode: room.roomCode })).errorCode, 'GAME_STARTED');
  host.disconnect();
  await changed;
  const returned = await connect();
  const result = await request(returned, 'room:reconnect', { roomCode: room.roomCode, playerId: 'p1', reconnectToken: room.reconnectToken });
  assert(result.success);
  assert.equal(result.player.isHost, true);
  assert.equal(result.room.gameState.isRolling, false);
  assert.equal(result.room.gameState.builtThisTurn, true);
  assert.equal(result.room.players.find((player) => player.isAI)?.isHost, false);
});

test('A disconnected active human is skipped to the next bot and per-turn construction state resets', async (t) => {
  const { connect } = await setup(t, { disconnectTimeoutMs: 40 });
  const host = await connect(); const guest = await connect();
  const room = await request(host, 'room:create', human);
  await request(host, 'room:add_bot', { roomCode: room.roomCode });
  await request(guest, 'room:join', { ...human, roomCode: room.roomCode });
  let state = await start(host, room.roomCode);
  await sync(host, guest, room.roomCode, { ...state, phase: 'building', builtThisTurn: true });
  const passed = event<{ gameState: GameState }>(guest, 'turn:auto_passed');
  host.disconnect();
  state = (await passed).gameState;
  assert.equal(state.activePlayerIndex, 1);
  assert.equal(state.players[1].isAI, true);
  assert.equal(state.builtThisTurn, false);
  const returned = await connect();
  const result = await request(returned, 'room:reconnect', { roomCode: room.roomCode, playerId: 'p1', reconnectToken: room.reconnectToken });
  assert(result.success);
  assert.equal((await sync(guest, returned, room.roomCode, { ...state, phase: 'building' })).phase, 'building');
});

test('Explicit host departure also hands a pending bot turn to the remaining human host', async (t) => {
  const { connect } = await setup(t);
  const host = await connect(); const guest = await connect(); const observer = await connect();
  const room = await request(host, 'room:create', human);
  await request(guest, 'room:join', { ...human, roomCode: room.roomCode });
  await request(observer, 'room:join', { ...human, roomCode: room.roomCode });
  await request(host, 'room:add_bot', { roomCode: room.roomCode });
  let state = await start(host, room.roomCode);
  await sync(host, guest, room.roomCode, { ...state, activePlayerIndex: 3, isRolling: true, builtThisTurn: true });
  const transferred = event<{ room: Room }>(guest, 'room:update', (value) => value.room.hostSocketId === guest.id);
  const recovered = event<{ gameState: GameState }>(guest, 'game:sync_broadcast');
  assert((await request(host, 'room:leave', { roomCode: room.roomCode })).success);
  assert.equal((await transferred).room.players.find((player) => player.isHost)?.id, 'p2');
  state = (await recovered).gameState;
  assert.equal(state.isRolling, false);
  assert.equal(state.builtThisTurn, true);
  assert.equal((await sync(guest, observer, room.roomCode, { ...state, phase: 'building' })).phase, 'building');
});

test('The production Docker image copies the bot module imported by the server', async () => {
  const dockerfile = await readFile(new URL('../server/Dockerfile', import.meta.url), 'utf8');
  assert.match(dockerfile, /COPY\s+index\.js\s+botPlayers\.js\s+\.\//);
});
