import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { Player, PlayerId } from '../src/types/game.ts';
import { getNextTurn } from '../src/utils/turnOrder.ts';

function player(id: PlayerId, overrides: Partial<Player> = {}): Player {
  return {
    id, name: id, avatar: 'surgeon', avatarTitle: 'Sebész', color: '#0284c7',
    cash: 1_500_000, debt: 0, position: 0, builtElements: [], activeBuffs: [], skipTurns: 0,
    ...overrides,
  };
}

function freezePlayers(players: Player[]): readonly Player[] {
  for (const doctor of players) {
    Object.freeze(doctor.activeBuffs);
    Object.freeze(doctor.builtElements);
    Object.freeze(doctor);
  }
  return Object.freeze(players);
}

test('normal turn order wraps at the first seat without changing player state', () => {
  const players = freezePlayers([player('p1'), player('p2'), player('p3')]);
  const next = getNextTurn(players, 2, 4)!;
  assert.equal(next.activePlayerIndex, 0);
  assert.equal(next.turnNumber, 5);
  assert.deepEqual(next.skippedTurns, []);
  assert.deepEqual(next.players, players);
  assert.notEqual(next.players, players);
});

test('two penalized players exhaust every missed turn before the next roll', () => {
  const players = freezePlayers([player('p1', { skipTurns: 1 }), player('p2', { skipTurns: 2 })]);
  const next = getNextTurn(players, 0, 1)!;
  assert.equal(next.activePlayerIndex, 0);
  assert.equal(next.turnNumber, 3);
  assert.deepEqual(next.players.map((doctor) => doctor.skipTurns), [0, 0]);
  assert.deepEqual(next.skippedTurns, [
    { playerId: 'p2', playerName: 'p2', turnNumber: 1, remainingTurns: 1 },
    { playerId: 'p1', playerName: 'p1', turnNumber: 2, remainingTurns: 0 },
    { playerId: 'p2', playerName: 'p2', turnNumber: 2, remainingTurns: 0 },
  ]);
  assert.deepEqual(players.map((doctor) => doctor.skipTurns), [1, 2]);
});

test('several fully skipped rounds preserve round numbers and remaining penalties', () => {
  const players = freezePlayers([
    player('p1', { skipTurns: 3 }), player('p2', { skipTurns: 2 }), player('p3', { skipTurns: 4 }),
  ]);
  const next = getNextTurn(players, 0, 4)!;
  assert.equal(next.activePlayerIndex, 1);
  assert.equal(next.turnNumber, 6);
  assert.deepEqual(next.players.map((doctor) => doctor.skipTurns), [1, 0, 2]);
  assert.equal(next.skippedTurns.length, 6);
  assert.deepEqual(next.skippedTurns.map((turn) => turn.turnNumber), [4, 4, 5, 5, 5, 6]);
});

test('eliminated seats never play or consume penalties while surviving players skip turns', () => {
  const players = freezePlayers([
    player('p1', { skipTurns: 1 }), player('p2', { eliminated: true, skipTurns: 50 }),
    player('p3', { eliminated: true }), player('p4', { skipTurns: 1 }),
  ]);
  const next = getNextTurn(players, 0, 1)!;
  assert.equal(next.activePlayerIndex, 3);
  assert.equal(next.turnNumber, 2);
  assert.equal(next.players[3].skipTurns, 0);
  assert.equal(next.players[1].skipTurns, 50);
  assert.deepEqual(next.skippedTurns.map((turn) => turn.playerId), ['p4', 'p1']);
});

test('a surviving player is found after multiple passes through eliminated seats', () => {
  const players = freezePlayers([
    player('p1', { eliminated: true }), player('p2', { eliminated: true }), player('p3', { skipTurns: 3 }),
  ]);
  const next = getNextTurn(players, 0, 5)!;
  assert.equal(next.activePlayerIndex, 2);
  assert.equal(next.turnNumber, 8);
  assert.equal(next.players[2].skipTurns, 0);
  assert.equal(next.skippedTurns.length, 3);
});

test('empty and fully eliminated rosters have no next turn', () => {
  assert.equal(getNextTurn([], 0, 1), null);
  const players = freezePlayers([player('p1', { eliminated: true }), player('p2', { eliminated: true, skipTurns: 2 })]);
  assert.equal(getNextTurn(players, 0, 1), null);
  assert.equal(players[1].skipTurns, 2);
});
