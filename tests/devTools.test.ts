import assert from 'node:assert/strict';
import test from 'node:test';
import { EVENT_CARDS } from '../src/data/cards.ts';
import { CLINIC_ELEMENTS } from '../src/data/clinicElements.ts';
import { BOARD_TILES } from '../src/data/tiles.ts';
import { GAME_CONSTANTS } from '../src/types/game.ts';
import type { GameState, PlayerId } from '../src/types/game.ts';
import {
  applyDevAction,
  canUseDevTools,
  checkDevPassword,
  isDevModeStored,
  setDevModeStored,
  DEV_PASSWORD,
  DEV_STORAGE_KEY,
} from '../src/utils/devTools.ts';
import type { DevAction } from '../src/utils/devTools.ts';

function deepFreeze<T>(value: T): T {
  if (value !== null && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const child of Object.values(value)) deepFreeze(child);
  }
  return value;
}

function createState(overrides: Partial<GameState> = {}): GameState {
  return deepFreeze({
    players: [
      {
        id: 'p1', name: 'Anna', color: '#0891b2', avatar: 'surgeon',
        avatarTitle: 'Sebész', cash: 1_500_000, debt: 200_000, position: 35,
        builtElements: ['reception'], skipTurns: 1, activeBuffs: [],
      },
      {
        id: 'p2', name: 'Béla', color: '#0d9488', avatar: 'resident',
        avatarTitle: 'Rezidens', cash: 750_000, debt: 400_000, position: 7,
        builtElements: ['lab'], skipTurns: 0,
        activeBuffs: [{
          id: 'test-buff', name: 'Kedvezmény', description: 'Építési kedvezmény',
          type: 'building_discount', value: 15, remainingTurns: 2,
        }],
      },
    ],
    activePlayerIndex: 1,
    turnNumber: 4,
    phase: 'roll',
    diceResult: null,
    isRolling: false,
    drawnCard: null,
    cardDeck: EVENT_CARDS.filter((card) => card.id > 3).map((card) => card.id),
    discardDeck: [1, 2, 3],
    winner: null,
    logs: [{ id: 'initial-log', message: 'Játék indult', timestamp: 1, type: 'system' }],
    roundPassBonusGranted: false,
    ...overrides,
  } as GameState);
}

const actions: DevAction[] = [
  { type: 'adjust_cash', playerId: 'p1', amount: 1_000_000 },
  { type: 'teleport', playerId: 'p1', tileId: 0 },
  { type: 'draw_card', cardId: 4 },
  { type: 'instant_victory' },
];

test('cash edits target the selected player, preserve the input and record the change', () => {
  for (const amount of [1_000_000, -1_000_000]) {
    const before = createState();
    const snapshot = JSON.stringify(before);
    const after = applyDevAction(before, { type: 'adjust_cash', playerId: 'p1', amount });

    assert.notStrictEqual(after, before);
    assert.equal(after.players[0].cash, 1_500_000 + amount);
    assert.deepEqual(after.players[0], { ...before.players[0], cash: 1_500_000 + amount });
    assert.strictEqual(after.players[1], before.players[1]);
    assert.equal(after.activePlayerIndex, 1);
    assert.equal(after.phase, before.phase);
    assert.equal(after.logs[0].playerId, 'p1');
    assert.match(after.logs[0].message, /Fejlesztői teszt/);
    assert.strictEqual(after.logs[1], before.logs[0]);
    assert.equal(JSON.stringify(before), snapshot);
  }
});

test('cash subtraction clamps to zero without creating debt', () => {
  const before = createState();
  const after = applyDevAction(before, { type: 'adjust_cash', playerId: 'p2', amount: -1_000_000 });

  assert.equal(after.players[1].cash, 0);
  assert.equal(after.players[1].debt, before.players[1].debt);
  assert.strictEqual(after.players[0], before.players[0]);

  const atZero = createState({ players: after.players });
  assert.strictEqual(applyDevAction(atZero, { type: 'adjust_cash', playerId: 'p2', amount: -1_000_000 }), atZero);
});

test('invalid cash inputs, absent players and unsafe totals are no-ops', () => {
  const before = createState();
  for (const amount of [0, 1, -1, 999_999, -999_999, 2_000_000, 1.5, NaN, Infinity, -Infinity]) {
    assert.strictEqual(applyDevAction(before, { type: 'adjust_cash', playerId: 'p1', amount }), before);
  }
  assert.strictEqual(applyDevAction(before, {
    type: 'adjust_cash', playerId: 'missing' as PlayerId, amount: 1_000_000,
  }), before);

  const wealthy = createState({ players: before.players.map((player) => ({ ...player, cash: Number.MAX_SAFE_INTEGER })) });
  assert.strictEqual(applyDevAction(wealthy, { type: 'adjust_cash', playerId: 'p1', amount: 1_000_000 }), wealthy);
});

test('each of the 36 teleport destinations only changes the targeted pawn position', () => {
  assert.equal(BOARD_TILES.length, 36);
  for (const tile of BOARD_TILES) {
    const fixture = createState();
    const before = createState({
      players: fixture.players.map((player) => player.id === 'p1'
        ? { ...player, position: (tile.id + 1) % GAME_CONSTANTS.TOTAL_TILES }
        : player),
    });
    const snapshot = JSON.stringify(before);
    const after = applyDevAction(before, { type: 'teleport', playerId: 'p1', tileId: tile.id });

    assert.deepEqual(after.players[0], { ...before.players[0], position: tile.id });
    assert.strictEqual(after.players[1], before.players[1]);
    assert.equal(after.phase, before.phase);
    assert.equal(after.turnNumber, before.turnNumber);
    assert.equal(after.activePlayerIndex, before.activePlayerIndex);
    assert.equal(after.roundPassBonusGranted, false);
    assert.equal(after.drawnCard, null);
    assert.strictEqual(after.cardDeck, before.cardDeck);
    assert.strictEqual(after.discardDeck, before.discardDeck);
    assert.equal(JSON.stringify(before), snapshot);
  }
});

test('teleport rejects invalid tiles, missing players and an unchanged destination', () => {
  const before = createState();
  for (const tileId of [-1, 36, 1.5, NaN, Infinity]) {
    assert.strictEqual(applyDevAction(before, { type: 'teleport', playerId: 'p1', tileId }), before);
  }
  assert.strictEqual(applyDevAction(before, { type: 'teleport', playerId: 'missing' as PlayerId, tileId: 0 }), before);
  assert.strictEqual(applyDevAction(before, { type: 'teleport', playerId: 'p1', tileId: 35 }), before);
});

function assertCompleteUniqueDeck(state: GameState) {
  const ids = [...state.cardDeck, ...state.discardDeck];
  assert.equal(ids.length, 40);
  assert.equal(new Set(ids).size, 40);
  assert.deepEqual([...ids].sort((a, b) => a - b), EVENT_CARDS.map((card) => card.id).sort((a, b) => a - b));
}

test('a chosen card opens for the active player without applying its effect early', () => {
  const before = createState();
  const snapshot = JSON.stringify(before);
  const after = applyDevAction(before, { type: 'draw_card', cardId: 4 });

  assert.equal(after.phase, 'card_modal');
  assert.equal(after.drawnCard?.id, 4);
  assert.strictEqual(after.players, before.players);
  assert.equal(after.logs[0].playerId, 'p2');
  assert.equal(after.cardDeck.includes(4), false);
  assert.equal(after.discardDeck.at(-1), 4);
  assertCompleteUniqueDeck(after);
  assert.equal(JSON.stringify(before), snapshot);

  for (const action of actions) assert.strictEqual(applyDevAction(after, action), after);
});

test('retesting a discarded card preserves a unique and complete 40-card deck', () => {
  let state = createState();
  for (const cardId of [2, 2, 4, 4, 40, 1]) {
    const before = createState({ ...state, phase: 'building', drawnCard: null });
    const snapshot = JSON.stringify(before);
    state = applyDevAction(before, { type: 'draw_card', cardId });
    assert.equal(state.drawnCard?.id, cardId);
    assertCompleteUniqueDeck(state);
    assert.equal(state.discardDeck.filter((id) => id === cardId).length, 1);
    assert.equal(JSON.stringify(before), snapshot);
  }
});

test('card picker rejects ids that do not identify a real card', () => {
  const before = createState();
  for (const cardId of [0, -1, 41, 1.5, NaN, Infinity]) {
    assert.strictEqual(applyDevAction(before, { type: 'draw_card', cardId }), before);
  }
});

test('instant victory satisfies all conditions and uses the same player object in winner and players', () => {
  for (const startingCash of [750_000, 5_000_000]) {
    const fixture = createState();
    const before = createState({
      phase: 'building',
      players: fixture.players.map((player) => player.id === 'p2' ? { ...player, cash: startingCash } : player),
    });
    const snapshot = JSON.stringify(before);
    const after = applyDevAction(before, { type: 'instant_victory' });
    const winner = after.winner;

    assert.ok(winner);
    assert.equal(after.phase, 'game_over');
    assert.equal(winner.id, 'p2');
    assert.strictEqual(winner, after.players[after.activePlayerIndex]);
    assert.strictEqual(after.players[0], before.players[0]);
    assert.deepEqual(winner.builtElements, CLINIC_ELEMENTS.map((element) => element.id));
    assert.equal(new Set(winner.builtElements).size, 8);
    assert.equal(winner.cash, Math.max(startingCash, GAME_CONSTANTS.VICTORY_MIN_CASH));
    assert.equal(winner.debt, 0);
    assert.equal(winner.position, before.players[1].position);
    assert.equal(after.drawnCard, null);
    assert.equal(JSON.stringify(before), snapshot);
  }
});

test('all commands are blocked during setup, rolling, pending events and game over', () => {
  const fixture = createState();
  const unavailableStates: GameState[] = [
    createState({ phase: 'setup' }),
    createState({ isRolling: true }),
    createState({ phase: 'moving' }),
    createState({ phase: 'tile_action' }),
    createState({ phase: 'card_modal', drawnCard: EVENT_CARDS[0] }),
    createState({ phase: 'bank_modal' }),
    createState({ phase: 'turn_end' }),
    createState({ phase: 'game_over' }),
    createState({ winner: fixture.players[1] }),
    createState({ players: [] }),
    createState({ activePlayerIndex: 99 }),
  ];
  for (const before of unavailableStates) {
    assert.equal(canUseDevTools(before), false);
    for (const action of actions) assert.strictEqual(applyDevAction(before, action), before);
  }
  assert.equal(canUseDevTools(createState({ phase: 'roll' })), true);
  assert.equal(canUseDevTools(createState({ phase: 'building' })), true);
});

test('checkDevPassword validates codeblue112 case-insensitively and trims whitespace', () => {
  assert.equal(DEV_PASSWORD, 'codeblue112');
  assert.equal(checkDevPassword('codeblue112'), true);
  assert.equal(checkDevPassword('CodeBlue112'), true);
  assert.equal(checkDevPassword('  codeblue112  '), true);
  assert.equal(checkDevPassword('CODEBLUE112'), true);
  assert.equal(checkDevPassword(''), false);
  assert.equal(checkDevPassword('wrong'), false);
  assert.equal(checkDevPassword('codeblue'), false);
  assert.equal(checkDevPassword('112'), false);
});

test('isDevModeStored and setDevModeStored handle storage and URL query flags safely', () => {
  // 1. Without window (Node.js test environment)
  assert.equal(isDevModeStored(), false);
  assert.doesNotThrow(() => setDevModeStored(true));
  assert.doesNotThrow(() => setDevModeStored(false));

  // 2. Mocking browser window and sessionStorage
  const storage = new Map<string, string>();
  const originalWindow = (globalThis as unknown as { window?: unknown }).window;

  (globalThis as unknown as { window: unknown }).window = {
    location: { search: '' },
    sessionStorage: {
      getItem: (key: string) => storage.get(key) ?? null,
      setItem: (key: string, value: string) => storage.set(key, value),
      removeItem: (key: string) => storage.delete(key),
    },
  };

  try {
    assert.equal(isDevModeStored(), false);
    setDevModeStored(true);
    assert.equal(storage.get(DEV_STORAGE_KEY), 'true');
    assert.equal(isDevModeStored(), true);

    setDevModeStored(false);
    assert.equal(storage.has(DEV_STORAGE_KEY), false);
    assert.equal(isDevModeStored(), false);

    // URL parameter overrides
    ((globalThis as unknown as { window: { location: { search: string } } }).window).location.search = '?dev=1';
    assert.equal(isDevModeStored(), true);

    ((globalThis as unknown as { window: { location: { search: string } } }).window).location.search = '?demo=1';
    assert.equal(isDevModeStored(), true);

    ((globalThis as unknown as { window: { location: { search: string } } }).window).location.search = '?dev=codeblue112';
    assert.equal(isDevModeStored(), true);

    ((globalThis as unknown as { window: { location: { search: string } } }).window).location.search = '?other=test';
    assert.equal(isDevModeStored(), false);
  } finally {
    if (originalWindow !== undefined) {
      (globalThis as unknown as { window: unknown }).window = originalWindow;
    } else {
      delete (globalThis as unknown as { window?: unknown }).window;
    }
  }
});
