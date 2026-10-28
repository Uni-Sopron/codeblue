import assert from 'node:assert/strict';
import { test } from 'node:test';
import { addBotToRoom, removeBotFromRoom, canDriveActivePlayer, hasValidRoster, transferHostToHuman } from '../server/botPlayers.js';

const human = (id = 'p1', socketId = 'host', avatar = 'surgeon') => ({ id, socketId, avatar, name: 'Orvos', color: '#0284c7', isAI: false, isHost: id === 'p1', connected: true });
const room = () => ({ hostSocketId: 'host', gameStarted: false, players: [human()], gameState: null as unknown });

test('a host fills three free slots with distinct named doctors and virtual ids', () => {
  const current = room();
  for (let index = 0; index < 3; index++) assert.equal(addBotToRoom(current, 'host').success, true);
  assert.deepEqual(current.players.slice(1).map((player) => player.name), ['Dr. AI Neumann', 'Dr. AI Turing', 'Dr. AI Lovelace']);
  assert.equal(new Set(current.players.map((player) => player.avatar)).size, 4);
  assert.equal(new Set(current.players.map((player) => player.color)).size, 4);
  assert.equal(new Set(current.players.map((player) => player.socketId)).size, 4);
  assert.ok(current.players.slice(1).every((player) => player.isAI && player.connected && !player.isHost && player.socketId.startsWith('bot:')));
});

test('guests and outsiders cannot add bots or mutate the room', () => {
  const current = room();
  const before = structuredClone(current);
  assert.equal(addBotToRoom(current, 'guest').success, false);
  assert.deepEqual(current, before);
});

test('a full room cannot gain a fifth player', () => {
  const current = room();
  for (let index = 0; index < 3; index++) addBotToRoom(current, 'host');
  assert.equal(addBotToRoom(current, 'host').success, false);
  assert.equal(current.players.length, 4);
});

test('bot appearance adapts when a human already owns the preferred avatar', () => {
  const current = room();
  current.players[0].avatar = 'diagnostician';
  const bot = addBotToRoom(current, 'host').player;
  assert.notEqual(bot?.avatar, 'diagnostician');
  assert.notEqual(bot?.color, current.players[0].color);
});

test('only a host may remove an existing bot before play starts', () => {
  const current = room();
  const bot = addBotToRoom(current, 'host').player!;
  assert.equal(removeBotFromRoom(current, 'guest', bot.id).success, false);
  assert.equal(removeBotFromRoom(current, 'host', 'p1').success, false);
  assert.equal(removeBotFromRoom(current, 'host', bot.id).success, true);
  assert.equal(current.players.length, 1);
});

test('removing a bot preserves human ids and reuses only the free slot', () => {
  const current = room();
  const first = addBotToRoom(current, 'host').player!;
  current.players.push(human('p3', 'guest', 'chief_physician'));
  removeBotFromRoom(current, 'host', first.id);
  const replacement = addBotToRoom(current, 'host').player!;
  assert.equal(replacement.id, 'p2');
  assert.equal(current.players.find((player) => player.socketId === 'guest')?.id, 'p3');
});

test('started games reject both bot addition and deletion', () => {
  const current = room();
  const bot = addBotToRoom(current, 'host').player!;
  current.gameStarted = true;
  assert.equal(addBotToRoom(current, 'host').success, false);
  assert.equal(removeBotFromRoom(current, 'host', bot.id).success, false);
});

function activeRoom(activeIndex = 1) {
  const current = room();
  addBotToRoom(current, 'host');
  current.players.push(human('p3', 'guest', 'resident'));
  current.gameStarted = true;
  current.gameState = { players: structuredClone(current.players), activePlayerIndex: activeIndex };
  return current;
}

test('only the current host drives a virtual doctor', () => {
  const current = activeRoom();
  assert.equal(canDriveActivePlayer(current, 'host'), true);
  assert.equal(canDriveActivePlayer(current, 'guest'), false);
  assert.equal(canDriveActivePlayer(current, 'outsider'), false);
  assert.equal(canDriveActivePlayer(current, current.players[1].socketId), false);
});

test('host authority does not authorize a human guest turn', () => {
  const current = activeRoom(2);
  assert.equal(canDriveActivePlayer(current, 'guest'), true);
  assert.equal(canDriveActivePlayer(current, 'host'), false);
});

test('missing, disconnected and unstarted senders cannot drive game state', () => {
  const current = activeRoom();
  current.players[0].connected = false;
  assert.equal(canDriveActivePlayer(current, 'host'), false);
  current.gameStarted = false;
  assert.equal(canDriveActivePlayer(current, 'guest'), false);
  assert.equal(canDriveActivePlayer(null, 'host'), false);
});

test('bot flags, player ids and roster order cannot be changed in client state', () => {
  const current = activeRoom();
  assert.equal(hasValidRoster(current, current.gameState), true);
  const altered = structuredClone(current.gameState) as { players: { id:string; isAI:boolean }[]; activePlayerIndex:number };
  altered.players[1].isAI = false;
  assert.equal(hasValidRoster(current, altered), false);
  altered.players[1].isAI = true;
  altered.players.reverse();
  assert.equal(hasValidRoster(current, altered), false);
  altered.activePlayerIndex = -1;
  assert.equal(hasValidRoster(current, altered), false);
  assert.equal(hasValidRoster(current, null), false);
});

test('host transfer selects a connected human and authorizes that browser for bots', () => {
  const current = activeRoom();
  current.players[0].connected = false;
  const host = transferHostToHuman(current);
  assert.equal(host?.socketId, 'guest');
  assert.equal(current.hostSocketId, 'guest');
  assert.equal(current.players[1].isHost, false);
  assert.equal(canDriveActivePlayer(current, 'guest'), true);
  assert.equal(canDriveActivePlayer(current, 'host'), false);
});

test('a bot is never promoted when no human remains connected', () => {
  const current = activeRoom();
  for (const player of current.players) if (!player.isAI) player.connected = false;
  assert.equal(transferHostToHuman(current), undefined);
  assert.equal(current.hostSocketId, '');
  assert.ok(current.players.every((player) => !player.isHost));
});

test('host handover releases an unfinished bot roll and preserves construction state', () => {
  const current = activeRoom();
  current.gameState = { ...(current.gameState as object), phase: 'roll', isRolling: true, diceResult: 6, builtThisTurn: true };
  current.players[0].connected = false;
  transferHostToHuman(current);
  const state = current.gameState as { phase:string; isRolling:boolean; diceResult:number|null; builtThisTurn:boolean };
  assert.equal(state.phase, 'roll');
  assert.equal(state.isRolling, false);
  assert.equal(state.diceResult, null);
  assert.equal(state.builtThisTurn, true);
});
