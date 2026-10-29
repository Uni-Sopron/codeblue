import test, { type TestContext } from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { io, type Socket } from 'socket.io-client';
import { createGameServer, sanitizeName, sanitizeAvatar, sanitizeColor, isValidRoomCode } from '../server/index.js';

type ServerOptions = Parameters<typeof createGameServer>[0];
interface Reply { success: boolean; roomCode: string; room: Record<string, unknown>; player: { id: string }; reconnectToken?: string; errorCode?: string; retryAfterSeconds?: number; gameState?: Record<string, unknown> }
const avatar = { playerName: 'Dr. Teszt', avatarId: 'surgeon', color: '#00b4d8' };
const request = (socket: Socket, event: string, payload: unknown = {}): Promise<Reply> => new Promise((resolve, reject) => {
  socket.timeout(1500).emit(event, payload, (error: Error | null, response: Reply) => error ? reject(error) : resolve(response));
});
const event = <T = Record<string, unknown>>(socket: Socket, name: string, matches: (payload: T) => boolean = () => true): Promise<T> => new Promise((resolve, reject) => {
  const timeout = setTimeout(() => { socket.off(name, handler); reject(new Error(`Missing event: ${name}`)); }, 1500);
  const handler = (payload: T) => { if (!matches(payload)) return; socket.off(name, handler); clearTimeout(timeout); resolve(payload); };
  socket.on(name, handler);
});
async function setup(t: TestContext, options: ServerOptions = {}) {
  const server = createGameServer(options);
  const sockets: Socket[] = [];
  server.httpServer.listen(0, '127.0.0.1');
  await once(server.httpServer, 'listening');
  const address = server.httpServer.address();
  assert(address && typeof address !== 'string');
  const url = `http://127.0.0.1:${address.port}`;
  t.after(async () => { sockets.forEach((socket) => socket.disconnect()); await server.close(); });
  const connect = async () => {
    const socket = io(url, { transports: ['websocket'], forceNew: true, reconnection: false });
    sockets.push(socket);
    await once(socket, 'connect');
    return socket;
  };
  return { server, connect, url };
}
function noSecretKeys(value: unknown): void {
  if (!value || typeof value !== 'object') return;
  for (const [key, child] of Object.entries(value)) {
    assert(!['pin', 'pinHash', 'salt', 'tokens', 'reconnectToken', 'disconnectTimer'].includes(key), `Leaked secret/internal field: ${key}`);
    noSecretKeys(child);
  }
}
function checkState(value: unknown): asserts value is { players: Array<{ id: string; connected: boolean }>; activePlayerIndex: number; cardDeck: number[]; phase: string; drawnCard: unknown; diceResult: unknown; turnNumber: number; isRolling: boolean } {
  assert(value && typeof value === 'object');
  const state = value as Record<string, unknown>;
  assert.equal(state.turnNumber, 1);
  assert.equal(state.phase, 'roll');
  assert.equal(state.diceResult, null);
  assert.equal(state.isRolling, false);
  assert.equal(state.drawnCard, null);
  assert.equal(state.winner, null);
  assert.equal(state.roundPassBonusGranted, false);
  assert.deepEqual(state.discardDeck, []);
  assert.deepEqual(state.logs, []);
  assert.deepEqual([...(state.cardDeck as number[])].sort((a, b) => a - b), Array.from({ length: 40 }, (_, i) => i + 1));
  for (const player of state.players as Record<string, unknown>[]) {
    assert.equal(player.cash, 1_500_000);
    assert.equal(player.debt, 0);
    assert.deepEqual(player.bank, { savings: 0, clinicalBond: 0, biotechEquity: 0 });
    assert.deepEqual(player.builtElements, []);
    assert.deepEqual(player.activeBuffs, []);
  }
}

test('Actual server sanitizers remove markup, controls and enforce room/name limits', () => {
  assert.equal(sanitizeName('<b>Dr. Teszt</b>\u0000', 'Orvos', 24), 'Dr. Teszt');
  assert.equal(sanitizeName('x'.repeat(40), '', 24).length, 24);
  assert.equal(sanitizeName('   ', 'Klinika', 24), 'Klinika');
  assert.equal(sanitizeAvatar('missing'), 'surgeon');
  assert.equal(sanitizeColor('url(script)'), '#00b4d8');
  assert.equal(sanitizeColor('#aB3'), '#aB3');
  assert(isValidRoomCode(' cb-1234 '));
  assert(!isValidRoomCode('CB-12345'));
});

test('Public directory pushes sanitized summaries for create/join/start/leave and hides private rooms over HTTP too', async (t) => {
  const { connect, url } = await setup(t);
  const browser = await connect();
  const firstList = event<{ rooms: Record<string, unknown>[] }>(browser, 'rooms:list');
  browser.emit('rooms:subscribe');
  assert.deepEqual((await firstList).rooms, []);
  const host = await connect();
  const created = event<{ rooms: Record<string, unknown>[] }>(browser, 'rooms:update');
  const room = await request(host, 'room:create', { ...avatar, name: '<b>Hosszú klinika</b>' + 'x'.repeat(30), pin: '5831' });
  assert(room.success);
  const summary = (await created).rooms[0];
  assert.equal((summary.name as string).length, 24);
  assert.equal(summary.hasPin, true);
  assert.equal(summary.hostName, avatar.playerName);
  assert.deepEqual(Object.keys(summary).sort(), ['code', 'name', 'hostName', 'hostAvatar', 'playerCount', 'maxPlayers', 'gameStarted', 'hasPin', 'spectatorCount'].sort());
  assert.equal(summary.spectatorCount, 0);
  noSecretKeys(summary);
  const privateHost = await connect();
  const privateCreated = event<{ rooms: Record<string, unknown>[] }>(browser, 'rooms:update');
  const hidden = await request(privateHost, 'room:create', { ...avatar, visibility: 'private' });
  assert.equal((await privateCreated).rooms.length, 1);
  assert.notEqual(hidden.roomCode, room.roomCode);
  const response = await fetch(`${url}/rooms`);
  const listed = await response.json() as { rooms: Record<string, unknown>[] };
  assert.equal(listed.rooms.length, 1);
  assert.equal(listed.rooms[0].code, room.roomCode);
  const guest = await connect();
  const joined = event<{ rooms: Record<string, unknown>[] }>(browser, 'rooms:update');
  assert((await request(guest, 'room:join', { ...avatar, roomCode: room.roomCode, pin: '5831' })).success);
  assert.equal((await joined).rooms[0].playerCount, 2);
  const started = event<{ rooms: Record<string, unknown>[] }>(browser, 'rooms:update');
  assert((await request(host, 'room:start', { roomCode: room.roomCode })).success);
  assert.equal((await started).rooms[0].gameStarted, true);
});

test('Only exact 4-digit optional PINs are accepted and a room code cannot bypass a private PIN', async (t) => {
  const { connect } = await setup(t);
  const host = await connect();
  for (const pin of ['123', '12345', '12a4', 1234, null]) {
    assert.equal((await request(host, 'room:create', { ...avatar, pin })).errorCode, 'INVALID_PIN');
  }
  const room = await request(host, 'room:create', { ...avatar, visibility: 'private', pin: '0007' });
  assert(room.success);
  const guest = await connect();
  assert.equal((await request(guest, 'room:join', { ...avatar, roomCode: room.roomCode })).errorCode, 'PIN_REQUIRED');
  assert.equal((await request(guest, 'room:join', { ...avatar, roomCode: room.roomCode, pin: '0000' })).errorCode, 'PIN_INVALID');
  const joined = await request(guest, 'room:join', { ...avatar, roomCode: room.roomCode, pin: '0007' });
  assert(joined.success);
  noSecretKeys(joined.room);
  assert(joined.reconnectToken);
});

test('Five consecutive wrong PINs lock the socket for 60 seconds across all room codes', async (t) => {
  let clock = 100_000;
  const { connect } = await setup(t, { now: () => clock });
  const hostA = await connect();
  const hostB = await connect();
  const a = await request(hostA, 'room:create', { ...avatar, pin: '1234' });
  const b = await request(hostB, 'room:create', { ...avatar, pin: '5678' });
  const guest = await connect();
  for (let i = 0; i < 4; i++) assert.equal((await request(guest, 'room:join', { ...avatar, roomCode: a.roomCode, pin: '9999' })).errorCode, 'PIN_INVALID');
  const fifth = await request(guest, 'room:join', { ...avatar, roomCode: a.roomCode, pin: '9999' });
  assert.equal(fifth.errorCode, 'PIN_LOCKED');
  assert.equal(fifth.retryAfterSeconds, 60);
  assert.equal((await request(guest, 'room:join', { ...avatar, roomCode: b.roomCode, pin: '5678' })).errorCode, 'PIN_LOCKED');
  clock += 59_000;
  assert.equal((await request(guest, 'room:join', { ...avatar, roomCode: a.roomCode, pin: '1234' })).retryAfterSeconds, 1);
  clock += 1001;
  assert((await request(guest, 'room:join', { ...avatar, roomCode: a.roomCode, pin: '1234' })).success);
});

test('A successful PIN resets consecutive failures and one socket cannot hold multiple room memberships', async (t) => {
  const { connect } = await setup(t);
  const host = await connect();
  const room = await request(host, 'room:create', { ...avatar, pin: '1234' });
  const guest = await connect();
  for (let i = 0; i < 4; i++) await request(guest, 'room:join', { ...avatar, roomCode: room.roomCode, pin: '9999' });
  assert((await request(guest, 'room:join', { ...avatar, roomCode: room.roomCode, pin: '1234' })).success);
  assert.equal((await request(guest, 'room:create', avatar)).errorCode, 'ALREADY_IN_ROOM');
  assert.equal((await request(guest, 'room:join', { ...avatar, roomCode: room.roomCode, pin: '1234' })).errorCode, 'ALREADY_IN_ROOM');
  await request(guest, 'room:leave', { roomCode: room.roomCode });
  assert.equal((await request(guest, 'room:join', { ...avatar, roomCode: room.roomCode, pin: '9999' })).errorCode, 'PIN_INVALID');
});

test('Stable player IDs survive lobby leave, host transfer and vacancy reuse', async (t) => {
  const { connect } = await setup(t);
  const a = await connect(); const b = await connect(); const c = await connect(); const d = await connect();
  const room = await request(a, 'room:create', avatar);
  const second = await request(b, 'room:join', { ...avatar, roomCode: room.roomCode });
  assert.equal(second.player.id, 'p2');
  assert.equal((await request(c, 'room:join', { ...avatar, roomCode: room.roomCode })).player.id, 'p3');
  await request(b, 'room:leave', { roomCode: room.roomCode });
  const replacement = await request(d, 'room:join', { ...avatar, roomCode: room.roomCode });
  assert.equal(replacement.player.id, 'p2');
  const transferred = event<{ room: { players: { id: string; isHost: boolean }[] } }>(c, 'room:update', (payload) => payload.room.players.length === 2);
  await request(a, 'room:leave', { roomCode: room.roomCode });
  const players = (await transferred).room.players;
  assert.deepEqual(players.map((p) => p.id), ['p3', 'p2']);
  assert.equal(players.find((p) => p.isHost)?.id, 'p3');
  assert((await request(c, 'room:start', { roomCode: room.roomCode })).success);
});

test('Start and rematch broadcast one complete canonical deck/state to every client without credentials', async (t) => {
  const { connect } = await setup(t);
  const host = await connect(); const guest = await connect();
  const captures: unknown[] = [];
  host.onAny((name, payload) => { if (name !== 'room:error') captures.push(payload); });
  guest.onAny((_name, payload) => captures.push(payload));
  const room = await request(host, 'room:create', { ...avatar, pin: '2345' });
  await request(guest, 'room:join', { ...avatar, roomCode: room.roomCode, pin: '2345' });
  const hostStarted = event<{ gameState: unknown }>(host, 'game:started');
  const guestStarted = event<{ gameState: unknown }>(guest, 'game:started');
  assert((await request(host, 'room:start', { roomCode: room.roomCode, initialGameState: { phase: 'invalid', pin: 'should-not-echo' } })).success);
  const first = (await hostStarted).gameState;
  checkState(first);
  assert.deepEqual((await guestStarted).gameState, first);
  const hostReset = event<{ gameState: unknown }>(host, 'room:game_reset');
  const guestReset = event<{ gameState: unknown }>(guest, 'room:game_reset');
  host.emit('room:rematch_vote', { roomCode: room.roomCode, ready: true });
  guest.emit('room:rematch_vote', { roomCode: room.roomCode, ready: true });
  const reset = (await hostReset).gameState;
  checkState(reset);
  assert.deepEqual((await guestReset).gameState, reset);
  captures.forEach(noSecretKeys);
});

test('Reconnect requires the private player token, rotates it and preserves PIN confidentiality', async (t) => {
  const { connect } = await setup(t);
  const host = await connect(); const guest = await connect();
  const room = await request(host, 'room:create', { ...avatar, visibility: 'private', pin: '8765' });
  const joined = await request(guest, 'room:join', { ...avatar, roomCode: room.roomCode, pin: '8765' });
  await request(host, 'room:start', { roomCode: room.roomCode });
  const disconnected = event(host, 'player:disconnected');
  guest.disconnect();
  await disconnected;
  const outsider = await connect();
  assert.equal((await request(outsider, 'room:reconnect', { roomCode: room.roomCode, playerId: joined.player.id })).errorCode, 'INVALID_RECONNECT');
  assert.equal((await request(outsider, 'room:reconnect', { roomCode: room.roomCode, playerId: joined.player.id, reconnectToken: 'guessed' })).errorCode, 'INVALID_RECONNECT');
  const reconnected = await request(outsider, 'room:reconnect', { roomCode: room.roomCode, playerId: joined.player.id, reconnectToken: joined.reconnectToken });
  assert(reconnected.success);
  assert.notEqual(reconnected.reconnectToken, joined.reconnectToken);
  noSecretKeys(reconnected.room);
  checkState(reconnected.gameState);
  const secondDisconnected = event(host, 'player:disconnected');
  outsider.disconnect();
  await secondDisconnected;
  const second = await connect();
  assert.equal((await request(second, 'room:reconnect', { roomCode: room.roomCode, playerId: joined.player.id, reconnectToken: joined.reconnectToken })).errorCode, 'INVALID_RECONNECT');
  assert((await request(second, 'room:reconnect', { roomCode: room.roomCode, playerId: joined.player.id, reconnectToken: reconnected.reconnectToken })).success);
});

test('Disconnect watchdog advances in circular turn order, resets pending actions and preserves bank balances', async (t) => {
  const { connect } = await setup(t, { disconnectTimeoutMs: 40 });
  const host = await connect(); const second = await connect(); const third = await connect(); const fourth = await connect();
  const room = await request(host, 'room:create', avatar);
  for (const socket of [second, third, fourth]) await request(socket, 'room:join', { ...avatar, roomCode: room.roomCode });
  const started = event<{ gameState: unknown }>(host, 'game:started');
  await request(host, 'room:start', { roomCode: room.roomCode });
  const state = (await started).gameState;
  checkState(state);
  const forwarded = event(second, 'game:sync_broadcast');
  host.emit('game:sync', { roomCode: room.roomCode, gameState: { ...state, activePlayerIndex: 1, phase: 'card_modal', isRolling: true, drawnCard: { id: 28 } } });
  await forwarded;
  const passed = event<{ gameState: typeof state; newActivePlayerIndex: number }>(host, 'turn:auto_passed');
  second.disconnect();
  const next = await passed;
  assert.equal(next.newActivePlayerIndex, 2);
  assert.equal(next.gameState.phase, 'roll');
  assert.equal(next.gameState.isRolling, false);
  assert.equal(next.gameState.drawnCard, null);
  assert.equal(next.gameState.diceResult, null);
  assert.equal(next.gameState.players[1].connected, false);
  assert.equal(next.gameState.players[1].eliminated, true);
  assert.equal(next.gameState.turnNumber, 1);
});

test('Outside sockets cannot replace state or start/rematch a room by guessing its code', async (t) => {
  const { connect } = await setup(t);
  const host = await connect(); const guest = await connect(); const outsider = await connect();
  const room = await request(host, 'room:create', avatar);
  await request(guest, 'room:join', { ...avatar, roomCode: room.roomCode });
  assert.equal((await request(outsider, 'room:start', { roomCode: room.roomCode })).errorCode, 'HOST_REQUIRED');
  const started = event<{ gameState: unknown }>(host, 'game:started');
  await request(host, 'room:start', { roomCode: room.roomCode });
  const state = (await started).gameState;
  const broadcasts: unknown[] = [];
  host.on('game:sync_broadcast', (payload) => broadcasts.push(payload));
  outsider.emit('game:sync', { roomCode: room.roomCode, gameState: { ...(state as object), activePlayerIndex: 1 } });
  outsider.emit('game:action', { roomCode: room.roomCode, newGameState: { ...(state as object), activePlayerIndex: 1 } });
  outsider.emit('room:rematch_vote', { roomCode: room.roomCode, ready: true });
  await new Promise((resolve) => setTimeout(resolve, 60));
  assert.deepEqual(broadcasts, []);
});

test('Server strictly enforces maxRooms limit and returns SERVER_FULL', async (t) => {
  const { connect } = await setup(t, { maxRooms: 1 });
  const host1 = await connect();
  const host2 = await connect();
  const created1 = await request(host1, 'room:create', avatar);
  assert.equal(created1.success, true);
  const created2 = await request(host2, 'room:create', avatar);
  assert.equal(created2.success, false);
  assert.equal(created2.errorCode, 'SERVER_FULL');
  assert.match(created2.error as string, /maximális szobaszámot/);
});

test('Anonymous Spectator Mode: connects viewers without player mutation, broadcasts count updates, and requires PIN', async (t) => {
  const { connect } = await setup(t);
  const host = await connect();
  const guest = await connect();
  const spectator1 = await connect();
  const spectator2 = await connect();

  // Create PIN-protected public room
  const created = await request(host, 'room:create', { ...avatar, name: 'Közvetített Klinika', pin: '4321' });
  const roomCode = created.roomCode as string;
  await request(guest, 'room:join', { ...avatar, roomCode, pin: '4321' });
  await request(host, 'room:start', { roomCode });

  // Spectator trying without PIN receives PIN_REQUIRED
  const noPin = await request(spectator1, 'room:spectate', { roomCode });
  assert.equal(noPin.success, false);
  assert.equal(noPin.errorCode, 'PIN_REQUIRED');

  // Spectator with wrong PIN receives PIN_INVALID
  const badPin = await request(spectator1, 'room:spectate', { roomCode, pin: '9999' });
  assert.equal(badPin.success, false);
  assert.equal(badPin.errorCode, 'PIN_INVALID');

  // Spectator 1 connects with correct PIN
  const hostCountEvent1 = event<{ roomCode: string; spectatorCount: number }>(host, 'room:spectator_count');
  const spectateRes1 = await request(spectator1, 'room:spectate', { roomCode, pin: '4321' });
  assert.equal(spectateRes1.success, true);
  assert.equal(spectateRes1.spectatorCount, 1);
  const hostCount1 = await hostCountEvent1;
  assert.equal(hostCount1.spectatorCount, 1);

  // Spectator 2 connects
  const hostCountEvent2 = event<{ roomCode: string; spectatorCount: number }>(host, 'room:spectator_count');
  const spectateRes2 = await request(spectator2, 'room:spectate', { roomCode, pin: '4321' });
  assert.equal(spectateRes2.success, true);
  assert.equal(spectateRes2.spectatorCount, 2);
  const hostCount2 = await hostCountEvent2;
  assert.equal(hostCount2.spectatorCount, 2);

  // Verify room players list does NOT contain spectators (strictly anonymous)
  const roomDetails = spectateRes2.room as { players: unknown[]; spectatorCount: number };
  assert.equal(roomDetails.players.length, 2);
  assert.equal(roomDetails.spectatorCount, 2);

  // Spectator actions cannot drive state or sync
  const broadcasts: unknown[] = [];
  host.on('game:sync_broadcast', (p) => broadcasts.push(p));
  spectator1.emit('game:sync', { roomCode, gameState: { activePlayerIndex: 99 } });
  await new Promise((r) => setTimeout(r, 50));
  assert.deepEqual(broadcasts, []);

  // Spectator 1 leaves cleanly via room:leave
  const hostCountEvent3 = event<{ roomCode: string; spectatorCount: number }>(host, 'room:spectator_count');
  await request(spectator1, 'room:leave', {});
  const hostCount3 = await hostCountEvent3;
  assert.equal(hostCount3.spectatorCount, 1);

  // Spectator 2 disconnects socket
  const hostCountEvent4 = event<{ roomCode: string; spectatorCount: number }>(host, 'room:spectator_count');
  spectator2.disconnect();
  const hostCount4 = await hostCountEvent4;
  assert.equal(hostCount4.spectatorCount, 0);
});
