import test, { type TestContext } from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { io, type Socket } from 'socket.io-client';
import type { GameState } from '../src/types/game.ts';
import { createGameServer } from '../server/index.js';

interface RoomPlayer { id: string; connected: boolean; eliminated?: boolean }
interface Room { code: string; players: RoomPlayer[]; gameState: GameState; offlineTimeouts: Record<string, number> }
interface Reply { success: boolean; roomCode: string; room: Room; player: RoomPlayer; reconnectToken?: string; errorCode?: string }
const human = { playerName: 'Dr. Teszt', avatarId: 'surgeon', color: '#0284c7' };
const wait = (milliseconds: number) => new Promise((resolve) => setTimeout(resolve, milliseconds));
const request = (socket: Socket, name: string, payload: unknown = {}): Promise<Reply> => new Promise((resolve, reject) => {
  socket.timeout(1500).emit(name, payload, (error: Error | null, response: Reply) => error ? reject(error) : resolve(response));
});
function event<T>(socket: Socket, name: string, matches: (payload: T) => boolean = () => true, timeoutMs = 1500): Promise<T> {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => { socket.off(name, handler); reject(new Error(`Missing event: ${name}`)); }, timeoutMs);
    const handler = (payload: T) => {
      if (!matches(payload)) return;
      clearTimeout(timeout);
      socket.off(name, handler);
      resolve(payload);
    };
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
async function start(host: Socket, roomCode: string): Promise<GameState> {
  const started = event<{ gameState: GameState }>(host, 'game:started');
  assert((await request(host, 'room:start', { roomCode })).success);
  return (await started).gameState;
}
async function threePlayers(t: TestContext, options: Parameters<typeof createGameServer>[0] = {}) {
  const environment = await setup(t, options);
  const host = await environment.connect();
  const guest = await environment.connect();
  const third = await environment.connect();
  const created = await request(host, 'room:create', human);
  const guestJoined = await request(guest, 'room:join', { ...human, roomCode: created.roomCode });
  const joined = await request(third, 'room:join', { ...human, roomCode: created.roomCode });
  const state = await start(host, created.roomCode);
  return { ...environment, host, guest, third, created, guestJoined, joined, state };
}

for (const name of ['game:sync', 'game:action'] as const) {
  test(`${name} cannot revive an eliminated player from a stale client snapshot`, async (t) => {
    const { host, guest, third, created, state } = await threePlayers(t);
    const eliminated = event<{ playerId: string }>(guest, 'player:eliminated');
    assert((await request(third, 'room:leave', { roomCode: created.roomCode })).success);
    assert.equal((await eliminated).playerId, 'p3');
    const broadcastName = name === 'game:sync' ? 'game:sync_broadcast' : 'game:action_broadcast';
    const broadcast = event<{ gameState?: GameState; newGameState?: GameState }>(guest, broadcastName);
    host.emit(name, { roomCode: created.roomCode, gameState: state, newGameState: state, actionType: 'end_turn' });
    const received = await broadcast;
    const next = (received.gameState ?? received.newGameState)!;
    assert.equal(next.players[2].eliminated, true);
    assert.equal(next.players[2].connected, false);
  });
}

test('A stale sync preserves an offline player and reconnect restores its canonical connection', async (t) => {
  const { host, guest, third, connect, created, joined, state } = await threePlayers(t, { disconnectTimeoutMs: 500 });
  const disconnected = event<{ playerId: string }>(guest, 'player:disconnected');
  third.disconnect();
  assert.equal((await disconnected).playerId, 'p3');
  const broadcast = event<{ gameState: GameState }>(guest, 'game:sync_broadcast');
  host.emit('game:sync', { roomCode: created.roomCode, gameState: state });
  const offline = (await broadcast).gameState;
  assert.equal(offline.players[2].connected, false);
  const returned = await connect();
  const reconnected = await request(returned, 'room:reconnect', { roomCode: created.roomCode, playerId: 'p3', reconnectToken: joined.reconnectToken });
  assert(reconnected.success);
  const restored = event<{ gameState: GameState }>(guest, 'game:sync_broadcast');
  host.emit('game:sync', { roomCode: created.roomCode, gameState: offline });
  assert.equal((await restored).gameState.players[2].connected, true);
});

test('Two disconnected players expire without awarding a win to the still-offline player', async (t) => {
  const { connect, url } = await setup(t, { disconnectTimeoutMs: 80 });
  const host = await connect(); const guest = await connect(); const spectator = await connect();
  const created = await request(host, 'room:create', human);
  await request(guest, 'room:join', { ...human, roomCode: created.roomCode });
  await start(host, created.roomCode);
  assert((await request(spectator, 'room:spectate', { roomCode: created.roomCode })).success);
  const winners: GameState['winner'][] = [];
  spectator.on('game:sync_broadcast', ({ gameState }: { gameState: GameState }) => { if (gameState.winner) winners.push(gameState.winner); });
  const closed = event<{ reason: string }>(spectator, 'room:closed');
  host.disconnect();
  await wait(10);
  guest.disconnect();
  assert.equal((await closed).reason, 'ALL_PLAYERS_LEFT');
  assert.deepEqual(winners, []);
  const health = await (await fetch(`${url}/health`)).json() as { activeRooms: number };
  assert.equal(health.activeRooms, 0);
});

test('The last connected winner can disconnect and the empty game is still cleaned up', async (t) => {
  const { connect, url } = await setup(t, { disconnectTimeoutMs: 60 });
  const host = await connect(); const guest = await connect(); const spectator = await connect();
  const created = await request(host, 'room:create', human);
  await request(guest, 'room:join', { ...human, roomCode: created.roomCode });
  await start(host, created.roomCode);
  await request(spectator, 'room:spectate', { roomCode: created.roomCode });
  const won = event<{ gameState: GameState }>(guest, 'game:sync_broadcast', ({ gameState }) => !!gameState.winner);
  await request(host, 'room:leave', { roomCode: created.roomCode });
  assert.equal((await won).gameState.winner?.id, 'p2');
  const closed = event<{ reason: string }>(spectator, 'room:closed');
  guest.disconnect();
  assert.equal((await closed).reason, 'ALL_PLAYERS_LEFT');
  const health = await (await fetch(`${url}/health`)).json() as { activeRooms: number };
  assert.equal(health.activeRooms, 0);
});

test('Departures after a regular victory preserve the original winner and victory log', async (t) => {
  const { host, guest, third, created, state } = await threePlayers(t);
  const victory: GameState = { ...state, phase: 'game_over', winner: state.players[0], logs: [{ id: 'original-victory', playerId: 'p1', message: 'Klinika elkészült.', timestamp: 1, type: 'system' }] };
  const won = event<{ gameState: GameState }>(guest, 'game:sync_broadcast');
  host.emit('game:sync', { roomCode: created.roomCode, gameState: victory });
  await won;
  await request(host, 'room:leave', { roomCode: created.roomCode });
  const updated = event<{ gameState: GameState }>(third, 'game:sync_broadcast', ({ gameState }) => gameState.players[1].eliminated === true);
  await request(guest, 'room:leave', { roomCode: created.roomCode });
  const next = (await updated).gameState;
  assert.equal(next.winner?.id, 'p1');
  assert.deepEqual(next.logs, victory.logs);
});

test('A rematch removes permanently departed players from both rosters while retaining stable IDs', async (t) => {
  const { connect } = await setup(t);
  const host = await connect(); const guest = await connect(); const third = await connect();
  const created = await request(host, 'room:create', human);
  await request(guest, 'room:join', { ...human, roomCode: created.roomCode });
  await request(third, 'room:join', { ...human, roomCode: created.roomCode });
  await request(host, 'room:add_bot', { roomCode: created.roomCode });
  await start(host, created.roomCode);
  await request(third, 'room:leave', { roomCode: created.roomCode });
  const reset = event<{ room: Room; gameState: GameState }>(guest, 'room:game_reset');
  host.emit('room:rematch_vote', { roomCode: created.roomCode, ready: true });
  guest.emit('room:rematch_vote', { roomCode: created.roomCode, ready: true });
  const next = await reset;
  assert.deepEqual(next.room.players.map((player) => player.id), ['p1', 'p2', 'p4']);
  assert.deepEqual(next.gameState.players.map((player) => player.id), ['p1', 'p2', 'p4']);
  assert(next.gameState.players.every((player) => !player.eliminated));
  assert.equal(next.gameState.players[2].isAI, true);
  assert.equal(next.gameState.activePlayerIndex, 0);
});

test('A rematch preserves the remaining reconnect deadline of a temporarily offline player', async (t) => {
  let stamp = 1000;
  const { host, guest, third, created } = await threePlayers(t, { disconnectTimeoutMs: 90, now: () => stamp });
  const disconnected = event<{ playerId: string }>(guest, 'player:disconnected');
  third.disconnect();
  await disconnected;
  stamp += 55;
  const reset = event<{ room: Room; gameState: GameState }>(guest, 'room:game_reset');
  host.emit('room:rematch_vote', { roomCode: created.roomCode, ready: true });
  guest.emit('room:rematch_vote', { roomCode: created.roomCode, ready: true });
  const next = await reset;
  assert.equal(next.gameState.players.find((player) => player.id === 'p3')?.connected, false);
  const eliminated = await event<{ playerId: string }>(guest, 'player:eliminated', (value) => value.playerId === 'p3', 75);
  assert.equal(eliminated.playerId, 'p3');
});

test('A lone survivor cannot restart a one-player game after the other doctor leaves', async (t) => {
  const { connect } = await setup(t);
  const host = await connect(); const guest = await connect();
  const created = await request(host, 'room:create', human);
  await request(guest, 'room:join', { ...human, roomCode: created.roomCode });
  await start(host, created.roomCode);
  await request(guest, 'room:leave', { roomCode: created.roomCode });
  const error = event<{ errorCode: string }>(host, 'room:error');
  let resets = 0;
  host.on('room:game_reset', () => resets++);
  host.emit('room:rematch_vote', { roomCode: created.roomCode, ready: true });
  assert.equal((await error).errorCode, 'NOT_ENOUGH_PLAYERS');
  assert.equal(resets, 0);
});

test('Reconnect cannot bypass an expired deadline while its timer callback is still pending', async (t) => {
  let stamp = 1000;
  const { host, third, connect, created, joined } = await threePlayers(t, { disconnectTimeoutMs: 1000, now: () => stamp });
  const disconnected = event(host, 'player:disconnected');
  third.disconnect();
  await disconnected;
  stamp += 1001;
  const returned = await connect();
  const eliminated = event<{ playerId: string }>(host, 'player:eliminated');
  const response = await request(returned, 'room:reconnect', { roomCode: created.roomCode, playerId: 'p3', reconnectToken: joined.reconnectToken });
  assert.equal(response.errorCode, 'PLAYER_ELIMINATED');
  assert.equal((await eliminated).playerId, 'p3');
});

test('A late end-turn targeting an eliminated doctor restores canonical state to its sender', async (t) => {
  const { host, guest, third, created, state } = await threePlayers(t);
  const eliminated = event<{ playerId: string }>(guest, 'player:eliminated');
  await request(third, 'room:leave', { roomCode: created.roomCode });
  await eliminated;
  const corrected = event<{ gameState: GameState }>(host, 'game:sync_broadcast');
  host.emit('game:action', { roomCode: created.roomCode, actionType: 'end_turn', newGameState: { ...state, activePlayerIndex: 2 } });
  const canonical = (await corrected).gameState;
  assert.equal(canonical.activePlayerIndex, 0);
  assert.equal(canonical.players[2].eliminated, true);
  const continued = event<{ gameState: GameState }>(guest, 'game:sync_broadcast');
  host.emit('game:sync', { roomCode: created.roomCode, gameState: { ...canonical, activePlayerIndex: 1, phase: 'roll' } });
  assert.equal((await continued).gameState.activePlayerIndex, 1);
});

test('Returning doctors can continue when the active doctor expires while everybody is offline', async (t) => {
  const { host, guest, third, connect, created, guestJoined, joined } = await threePlayers(t, { disconnectTimeoutMs: 90 });
  const spectator = await connect();
  await request(spectator, 'room:spectate', { roomCode: created.roomCode });
  const firstDisconnected = event<{ playerId: string }>(spectator, 'player:disconnected');
  host.disconnect();
  await firstDisconnected;
  await wait(35);
  const othersDisconnected = event<{ room: Room }>(spectator, 'room:update', ({ room }) => room.players.every((player) => !player.connected));
  guest.disconnect();
  third.disconnect();
  await othersDisconnected;
  const eliminated = await event<{ playerId: string }>(spectator, 'player:eliminated', (value) => value.playerId === 'p1');
  assert.equal(eliminated.playerId, 'p1');
  const returnedGuest = await connect(); const returnedThird = await connect();
  const guestReply = await request(returnedGuest, 'room:reconnect', { roomCode: created.roomCode, playerId: 'p2', reconnectToken: guestJoined.reconnectToken });
  const thirdReply = await request(returnedThird, 'room:reconnect', { roomCode: created.roomCode, playerId: 'p3', reconnectToken: joined.reconnectToken });
  assert(guestReply.success);
  assert(thirdReply.success);
  const resumed = thirdReply.room.gameState;
  assert.equal(resumed.winner, null);
  assert.equal(resumed.players[resumed.activePlayerIndex].id, 'p2');
  assert.equal(resumed.players[resumed.activePlayerIndex].eliminated, false);
  const continued = event<{ gameState: GameState }>(returnedThird, 'game:sync_broadcast');
  returnedGuest.emit('game:sync', { roomCode: created.roomCode, gameState: { ...resumed, phase: 'building' } });
  assert.equal((await continued).gameState.phase, 'building');
});

test('Room updates, spectator entry, rematch and reconnect share the current offline countdowns', async (t) => {
  const { host, guest, third, connect, created, guestJoined } = await threePlayers(t, { disconnectTimeoutMs: 500 });
  const disconnected = event<{ room: Room }>(host, 'room:update', ({ room }) => room.players.every((player) => player.id === 'p1' || !player.connected));
  guest.disconnect();
  third.disconnect();
  const snapshot = (await disconnected).room;
  assert.deepEqual(snapshot.offlineTimeouts, { p2: 1, p3: 1 });
  const spectator = await connect();
  const observed = await request(spectator, 'room:spectate', { roomCode: created.roomCode });
  assert.deepEqual(observed.room.offlineTimeouts, snapshot.offlineTimeouts);
  const reset = event<{ room: Room }>(host, 'room:game_reset');
  host.emit('room:rematch_vote', { roomCode: created.roomCode, ready: true });
  assert.deepEqual((await reset).room.offlineTimeouts, snapshot.offlineTimeouts);
  const returned = await connect();
  const updated = event<{ room: Room }>(host, 'room:update', ({ room }) => room.players.find((player) => player.id === 'p2')?.connected === true);
  const reconnected = await request(returned, 'room:reconnect', { roomCode: created.roomCode, playerId: 'p2', reconnectToken: guestJoined.reconnectToken });
  assert(reconnected.success);
  assert.deepEqual(reconnected.room.offlineTimeouts, { p3: 1 });
  assert.deepEqual((await updated).room.offlineTimeouts, { p3: 1 });
});

test('Late client updates after victory cannot replace the result or restart the finished turn', async (t) => {
  const { host, guest, created, state } = await threePlayers(t);
  const victory: GameState = { ...state, phase: 'game_over', winner: state.players[0], logs: [{ id: 'victory', message: 'Elkészült a klinika.', timestamp: 1, type: 'system' }] };
  const won = event<{ gameState: GameState }>(guest, 'game:sync_broadcast');
  host.emit('game:sync', { roomCode: created.roomCode, gameState: victory });
  await won;
  for (const name of ['game:sync', 'game:action']) {
    const restored = event<{ gameState: GameState }>(host, 'game:sync_broadcast');
    host.emit(name, { roomCode: created.roomCode, gameState: state, newGameState: state });
    const canonical = (await restored).gameState;
    assert.equal(canonical.phase, 'game_over');
    assert.equal(canonical.winner?.id, 'p1');
    assert.deepEqual(canonical.logs, victory.logs);
  }
});

test('An active human reconnects with a usable roll while preserving its bank and construction state', async (t) => {
  const { host, guest, connect, created, guestJoined, state } = await threePlayers(t, { disconnectTimeoutMs: 500 });
  const bank = { savings: 200_000, clinicalBond: 100_000, biotechEquity: 50_000 };
  const rolling: GameState = { ...state, activePlayerIndex: 1, phase: 'roll', isRolling: true, builtThisTurn: true,
    players: state.players.map((player) => player.id === 'p2' ? { ...player, bank } : player) };
  const startedRolling = event<{ gameState: GameState }>(guest, 'game:sync_broadcast');
  host.emit('game:sync', { roomCode: created.roomCode, gameState: rolling });
  await startedRolling;
  const disconnected = event<{ playerId: string }>(host, 'player:disconnected');
  guest.disconnect();
  assert.equal((await disconnected).playerId, 'p2');
  const returned = await connect();
  const reply = await request(returned, 'room:reconnect', { roomCode: created.roomCode, playerId: 'p2', reconnectToken: guestJoined.reconnectToken });
  assert(reply.success);
  const restored = reply.room.gameState;
  assert.equal(restored.activePlayerIndex, 1);
  assert.equal(restored.phase, 'roll');
  assert.equal(restored.isRolling, false);
  assert.equal(restored.diceResult, null);
  assert.equal(restored.builtThisTurn, true);
  assert.deepEqual(restored.players[1].bank, bank);
  const resumed = event<{ gameState: GameState }>(host, 'game:sync_broadcast', ({ gameState }) => gameState.phase === 'moving');
  returned.emit('game:sync', { roomCode: created.roomCode, gameState: { ...restored, phase: 'moving', diceResult: 4 } });
  assert.equal((await resumed).gameState.diceResult, 4);
});

test('A forced turn handover consumes a skip penalty and lets the next eligible doctor play', async (t) => {
  const { host, guest, third, created, state } = await threePlayers(t);
  const beforeDeparture: GameState = { ...state, phase: 'building', builtThisTurn: true, extraRollAvailable: true,
    players: state.players.map((player) => player.id === 'p2' ? { ...player, skipTurns: 1 } : player) };
  const prepared = event<{ gameState: GameState }>(guest, 'game:sync_broadcast');
  host.emit('game:sync', { roomCode: created.roomCode, gameState: beforeDeparture });
  await prepared;
  const passed = event<{ gameState: GameState }>(third, 'turn:auto_passed');
  await request(host, 'room:leave', { roomCode: created.roomCode });
  const next = (await passed).gameState;
  assert.equal(next.players[next.activePlayerIndex].id, 'p3');
  assert.equal(next.players[1].skipTurns, 0);
  assert.equal(next.players[0].eliminated, true);
  assert.equal(next.phase, 'roll');
  assert.equal(next.builtThisTurn, false);
  assert.equal(next.extraRollAvailable, false);
  assert(next.logs.some((log) => log.playerId === 'p2' && log.type === 'system'));
  const continued = event<{ gameState: GameState }>(guest, 'game:sync_broadcast');
  third.emit('game:sync', { roomCode: created.roomCode, gameState: { ...next, phase: 'building' } });
  assert.equal((await continued).gameState.players[1].skipTurns, 0);
});
