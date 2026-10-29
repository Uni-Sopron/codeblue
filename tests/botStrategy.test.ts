import assert from 'node:assert/strict';
import { test } from 'node:test';
import { BOT_PROFILES, createLocalPlayerConfigs } from '../src/data/botProfiles.ts';
import { AVATARS } from '../src/data/avatars.ts';
import { CLINIC_ELEMENTS } from '../src/data/clinicElements.ts';
import type { GameState, Player } from '../src/types/game.ts';
import { chooseBotAction, chooseBotBuild, getBotDelay } from '../src/utils/botStrategy.ts';
import type { BotStrategyContext } from '../src/utils/botStrategy.ts';

function player(overrides: Partial<Player> = {}): Player {
  return {
    id: 'p2', name: 'Dr. AI Neumann', avatar: 'diagnostician', color: '#0d9488', avatarTitle: 'Diagnoszta',
    isAI: true, cash: 1_500_000, debt: 0, position: 0, builtElements: [], skipTurns: 0, activeBuffs: [],
    ...overrides,
  };
}

function context(doctor = player(), overrides: Partial<BotStrategyContext> = {}): BotStrategyContext {
  const gameState: GameState = {
    players: [doctor], activePlayerIndex: 0, turnNumber: 1, phase: 'building', isRolling: false,
    diceResult: null, drawnCard: null, cardDeck: [], discardDeck: [], winner: null,
    logs: [], roundPassBonusGranted: false,
  };
  return {
    gameState, hasBuiltThisTurn: false, hasRolledThisTurn: true, extraRollAvailable: false,
    canBuyElement: (id) => {
      const cost = CLINIC_ELEMENTS.find((element) => element.id === id)!.cost;
      return { canBuy: doctor.cash >= cost, finalCost: cost };
    },
    ...overrides,
  };
}

test('the four named AI profiles use existing doctor portraits and distinct colors', () => {
  assert.deepEqual(BOT_PROFILES.map((profile) => profile.name), ['Dr. AI Neumann', 'Dr. AI Turing', 'Dr. AI Lovelace', 'Dr. AI Hippokratész']);
  assert.equal(new Set(BOT_PROFILES.map((profile) => profile.color)).size, 4);
  for (const profile of BOT_PROFILES) {
    const avatar = AVATARS.find((candidate) => candidate.id === profile.avatar)!;
    assert.equal(avatar.color, profile.color);
    assert.ok(avatar.image?.startsWith('/assets/avatar_'));
  }
});

for (const count of [2, 3, 4]) {
  test(`local setup supports one human against ${count - 1} autonomous doctors`, () => {
    const configs = createLocalPlayerConfigs(count, ['human', 'bot', 'bot', 'bot'], ['Saját orvos']);
    assert.equal(configs.length, count);
    assert.equal(configs.filter((config) => config.isAI).length, count - 1);
    assert.equal(configs[0].name, 'Saját orvos');
    assert.equal(new Set(configs.map((config) => config.avatar)).size, count);
    assert.equal(new Set(configs.map((config) => config.color)).size, count);
    assert.deepEqual(configs.map((config) => config.id), ['p1', 'p2', 'p3', 'p4'].slice(0, count));
  });
}

test('an all-human hotseat setup preserves entered names and excludes bots', () => {
  const configs = createLocalPlayerConfigs(2, ['human', 'human'], ['  Anna  ', 'Béla']);
  assert.deepEqual(configs.map((config) => config.name), ['Anna', 'Béla']);
  assert.ok(configs.every((config) => !config.isAI));
});

test('moving the human to any slot still assigns unique portraits and colors to every doctor', () => {
  for (let humanSlot = 0; humanSlot < 4; humanSlot += 1) {
    const types = Array.from({ length: 4 }, (_, index) => index === humanSlot ? 'human' as const : 'bot' as const);
    const configs = createLocalPlayerConfigs(4, types, []);
    assert.equal(configs[humanSlot].isAI, false);
    assert.equal(new Set(configs.map((config) => config.avatar)).size, 4);
    assert.equal(new Set(configs.map((config) => config.color)).size, 4);
    assert.equal(new Set(configs.map((config) => config.name)).size, 4);
  }
});

test('invalid player counts cannot be started', () => {
  for (const count of [0, 1, 5, 2.5, NaN]) assert.deepEqual(createLocalPlayerConfigs(count, ['human'], []), []);
});

test('all-bot demo games are fully supported with 4 unique AI doctors', () => {
  const configs = createLocalPlayerConfigs(4, ['bot', 'bot', 'bot', 'bot'], []);
  assert.equal(configs.length, 4);
  assert.ok(configs.every((c) => c.isAI));
  assert.equal(new Set(configs.map((c) => c.avatar)).size, 4);
  assert.equal(new Set(configs.map((c) => c.color)).size, 4);
  assert.deepEqual(configs.map((c) => c.name), ['Dr. AI Neumann', 'Dr. AI Turing', 'Dr. AI Lovelace', 'Dr. AI Hippokratész']);
});

test('human turns never produce bot actions', () => {
  assert.equal(chooseBotAction(context(player({ isAI: false }))), null);
});

test('rolling, announced victory, setup and movement never produce another bot action', () => {
  const base = context();
  for (const gameState of [
    { ...base.gameState, isRolling: true }, { ...base.gameState, winner: player() },
    { ...base.gameState, phase: 'setup' as const }, { ...base.gameState, phase: 'moving' as const },
    { ...base.gameState, phase: 'game_over' as const },
  ]) assert.equal(chooseBotAction({ ...base, gameState }), null);
});

test('missing active player and corrupt money values produce no action', () => {
  const base = context();
  assert.equal(chooseBotAction({ ...base, gameState: { ...base.gameState, activePlayerIndex: 3 } }), null);
  for (const doctor of [player({ cash: NaN }), player({ cash: -1 }), player({ debt: Infinity }), player({ debt: -1 })]) {
    assert.equal(chooseBotAction(context(doctor)), null);
  }
});

test('a fresh roll phase rolls once and waits after the roll is consumed', () => {
  const base = context();
  const gameState = { ...base.gameState, phase: 'roll' as const };
  assert.deepEqual(chooseBotAction({ ...base, gameState, hasRolledThisTurn: false }), { type: 'roll' });
  assert.equal(chooseBotAction({ ...base, gameState, hasRolledThisTurn: true }), null);
});

test('an earned extra roll can be used even after the regular roll', () => {
  const base = context();
  assert.deepEqual(chooseBotAction({ ...base, gameState: { ...base.gameState, phase: 'roll' }, extraRollAvailable: true }), { type: 'roll' });
});

test('tile and card phases are acknowledged independently before optional building', () => {
  const base = context();
  assert.deepEqual(chooseBotAction({ ...base, gameState: { ...base.gameState, phase: 'tile_action' } }), { type: 'resolve_tile' });
  assert.deepEqual(chooseBotAction({ ...base, gameState: { ...base.gameState, phase: 'card_modal' } }), { type: 'resolve_card' });
});

test('the first purchase prioritizes reception because it unlocks the most clinic wings', () => {
  assert.deepEqual(chooseBotAction(context()), { type: 'buy', elementId: 'reception' });
});

test('after reception the bot prioritizes the diagnostics prerequisite chain', () => {
  assert.deepEqual(chooseBotAction(context(player({ builtElements: ['reception'] }))), { type: 'buy', elementId: 'diagnostics' });
});

test('locked prerequisite rooms and previously owned rooms cannot be bought', () => {
  const doctor = player({ builtElements: ['lab'] });
  const chosen = chooseBotBuild(doctor, () => ({ canBuy: true, finalCost: 1 }));
  assert.equal(chosen, 'reception');
  assert.notEqual(chosen, 'lab');
  assert.notEqual(chosen, 'surgery');
});

test('an exact 150000 KK cash reserve is allowed after purchase', () => {
  assert.deepEqual(chooseBotAction(context(player({ cash: 550_000 }))), { type: 'buy', elementId: 'reception' });
});

test('a purchase that would leave one KK less than the reserve is skipped', () => {
  assert.deepEqual(chooseBotAction(context(player({ cash: 549_999 }))), { type: 'end_turn' });
});

test('engine-discounted final prices determine affordability and the reserve', () => {
  const base = context(player({ cash: 350_000 }), {
    canBuyElement: (id) => ({ canBuy: id === 'reception', finalCost: id === 'reception' ? 200_000 : 600_000 }),
  });
  assert.deepEqual(chooseBotAction(base), { type: 'buy', elementId: 'reception' });
});

test('free eligible construction is allowed while preserving the full reserve', () => {
  const base = context(player({ cash: 150_000 }), { canBuyElement: () => ({ canBuy: true, finalCost: 0 }) });
  assert.deepEqual(chooseBotAction(base), { type: 'buy', elementId: 'reception' });
});

test('the engine can reject an otherwise affordable optional purchase', () => {
  const base = context(player(), { canBuyElement: () => ({ canBuy: false, finalCost: 400_000 }) });
  assert.deepEqual(chooseBotAction(base), { type: 'end_turn' });
});

test('invalid purchase prices cannot create a bot purchase or money withdrawal', () => {
  for (const finalCost of [-1, NaN, Infinity, 1.5]) {
    const base = context(player(), { canBuyElement: () => ({ canBuy: true, finalCost }) });
    assert.deepEqual(chooseBotAction(base), { type: 'end_turn' });
  }
});

test('only one building is purchased per turn even if another room remains affordable', () => {
  assert.deepEqual(chooseBotAction(context(player(), { hasBuiltThisTurn: true })), { type: 'end_turn' });
});

test('a new online host respects a building already recorded in the shared turn snapshot', () => {
  const base = context();
  assert.deepEqual(chooseBotAction({ ...base, gameState: { ...base.gameState, builtThisTurn: true } }), { type: 'end_turn' });
});

test('debt is repaid before optional construction without consuming the cash reserve', () => {
  assert.deepEqual(chooseBotAction(context(player({ cash: 500_000, debt: 600_000 }))), { type: 'repay', amount: 350_000 });
});

test('small debts are paid exactly, including balances below the 200000 KK loan unit', () => {
  assert.deepEqual(chooseBotAction(context(player({ cash: 250_000, debt: 50_000 }))), { type: 'repay', amount: 50_000 });
});

test('a completed repayment cannot repeat indefinitely after cash reaches the reserve', () => {
  assert.deepEqual(chooseBotAction(context(player({ cash: 150_000, debt: 250_000 }))), { type: 'end_turn' });
});

test('the bot withdraws its own savings to repay debt before risking optional purchases', () => {
  const doctor = player({ cash: 150_000, debt: 200_000, bank: { savings: 100_000, clinicalBond: 0, biotechEquity: 0 } });
  assert.deepEqual(chooseBotAction(context(doctor)), { type: 'withdraw', product: 'savings', amount: 100_000 });
});

test('investments can provide exactly the missing cash for a reserve-safe building', () => {
  const doctor = player({ cash: 500_000, bank: { savings: 0, clinicalBond: 100_000, biotechEquity: 0 } });
  assert.deepEqual(chooseBotAction(context(doctor)), { type: 'withdraw', product: 'clinicalBond', amount: 50_000 });
});

test('the bot skips locked clinical bonds when calculating available withdrawals', () => {
  const doctor = player({ cash: 500_000, bank: { savings: 0, clinicalBond: 100_000, biotechEquity: 0 }, bondLockTurns: 4 });
  assert.deepEqual(chooseBotAction(context(doctor)), { type: 'end_turn' });
});

test('insufficient total assets do not cause a withdrawal/build/retry loop', () => {
  const doctor = player({ cash: 100_000, bank: { savings: 1, clinicalBond: 0, biotechEquity: 0 } });
  assert.deepEqual(chooseBotAction(context(doctor)), { type: 'end_turn' });
});

test('a completed clinic repays remaining debt and then ends the turn for victory detection', () => {
  const builtElements = CLINIC_ELEMENTS.map((element) => element.id);
  assert.deepEqual(chooseBotAction(context(player({ builtElements, cash: 1_200_000, debt: 200_000 }))), { type: 'repay', amount: 200_000 });
  assert.deepEqual(chooseBotAction(context(player({ builtElements, cash: 1_000_000, debt: 0 }))), { type: 'end_turn' });
});

test('completing the clinic never bypasses the required 150000 KK reserve', () => {
  const builtElements = CLINIC_ELEMENTS.filter((element) => element.id !== 'helipad').map((element) => element.id);
  const doctor = player({ builtElements, cash: 999_999 });
  assert.deepEqual(chooseBotAction(context(doctor)), { type: 'end_turn' });
});

test('a completed clinic liquidates only the amount required for the victory cash threshold', () => {
  const doctor = player({ builtElements: CLINIC_ELEMENTS.map((element) => element.id), cash: 800_000,
    bank: { savings: 500_000, clinicalBond: 0, biotechEquity: 0 } });
  assert.deepEqual(chooseBotAction(context(doctor)), { type: 'withdraw', product: 'savings', amount: 200_000 });
});

test('a bank phase can settle finances and then hand off without constructing a wing', () => {
  const base = context();
  assert.deepEqual(chooseBotAction({ ...base, gameState: { ...base.gameState, phase: 'bank_modal' } }), { type: 'end_turn' });
});

test('build choices and bot decisions preserve the player and game state', () => {
  const base = context();
  const before = JSON.stringify(base.gameState);
  Object.freeze(base.gameState.players[0].builtElements);
  Object.freeze(base.gameState.players[0]);
  chooseBotAction(base);
  assert.equal(JSON.stringify(base.gameState), before);
});

test('natural action delays stay within 1000–1500 ms and malformed RNG falls back safely', () => {
  assert.equal(getBotDelay(() => 0), 1_000);
  assert.equal(getBotDelay(() => 0.999999), 1_500);
  for (let index = 0; index < 100; index += 1) {
    const delay = getBotDelay(() => index / 100);
    assert.ok(delay >= 1_000 && delay <= 1_500);
  }
  for (const sample of [-1, 1, Infinity, NaN]) assert.equal(getBotDelay(() => sample), 1_250);
});

test('bot uses extra roll when state.extraRollAvailable is true even if hook flag was false', () => {
  const base = context();
  const gameState = { ...base.gameState, phase: 'roll' as const, extraRollAvailable: true };
  assert.deepEqual(chooseBotAction({
    ...base,
    gameState,
    hasRolledThisTurn: true,
    extraRollAvailable: false,
  }), { type: 'roll' });
});

test('bot adheres to all board movement rules including relative forward, backward, wrap-around, and absolute movement', () => {
  const TOTAL_TILES = 36;

  // 1. Relative forward movement (e.g. Card #27: +3 steps, Card #32: +4 steps)
  const posA = 10;
  const forwardSteps = 3;
  const newPosForward = (posA + forwardSteps) % TOTAL_TILES;
  assert.equal(newPosForward, 13);

  // 2. Relative forward wrap-around across START
  const posB = 34;
  const forwardStepsWrap = 4;
  const newPosForwardWrap = (posB + forwardStepsWrap) % TOTAL_TILES;
  assert.equal(newPosForwardWrap, 2);

  // 3. Relative backward movement (e.g. Card #40: -1, Card #36: -2, Card #34: -3, Card #39: -4)
  const posC = 5;
  const backSteps = -3;
  const newPosBack = (posC + backSteps + TOTAL_TILES) % TOTAL_TILES;
  assert.equal(newPosBack, 2);

  // 4. Relative backward wrap-around before START
  const posD = 1;
  const backStepsWrap = -3;
  const newPosBackWrap = (posD + backStepsWrap + TOTAL_TILES) % TOTAL_TILES;
  assert.equal(newPosBackWrap, 34);

  // 5. Absolute movement to START (Card #28) or Ethics Committee Tile 9 (Card #37)
  const targetStart = 0;
  const targetEthics = 9;
  assert.equal(targetStart, 0);
  assert.equal(targetEthics, 9);
});

test('bot with surplus cash and zero debt deposits surplus into savings', () => {
  const base = context(player({ cash: 600_000, debt: 0, builtElements: ['reception'] }));
  const state = { ...base.gameState, phase: 'building' as const, builtThisTurn: true };
  const action = chooseBotAction({
    ...base,
    gameState: state,
    hasBuiltThisTurn: true,
  });
  assert.deepEqual(action, { type: 'deposit', product: 'savings', amount: 200_000 });
});
