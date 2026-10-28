import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { BankProduct, GamePhase, GameState, Player } from '../src/types/game.ts';
import {
  accrueBankAtStart,
  accrueBankForMovement,
  applyBankTransaction,
  canUseBank,
  getBankBalances,
  isValidBankAmount,
} from '../src/utils/bank.ts';

function player(overrides: Partial<Player> = {}): Player {
  return {
    id: 'p1', name: 'Dr. Teszt', color: '#00b4d8', avatar: 'surgeon', avatarTitle: 'Sebész',
    cash: 1_000_000, debt: 0, position: 0, builtElements: [], skipTurns: 0, activeBuffs: [],
    bank: { savings: 0, clinicalBond: 0, biotechEquity: 0 },
    ...overrides,
  };
}

function state(overrides: Partial<GameState> = {}): GameState {
  return {
    players: [player(), player({ id: 'p2', name: 'Dr. Másik' })], activePlayerIndex: 0,
    turnNumber: 1, phase: 'building', diceResult: null, isRolling: false, drawnCard: null,
    cardDeck: [], discardDeck: [], winner: null, logs: [], roundPassBonusGranted: false,
    ...overrides,
  };
}

test('legacy players get independent zero bank balances without mutation', () => {
  const legacy = player({ bank: undefined });
  const first = getBankBalances(legacy);
  assert.deepEqual(first, { savings: 0, clinicalBond: 0, biotechEquity: 0 });
  first.savings = 50;
  assert.equal(getBankBalances(legacy).savings, 0);
  assert.equal(legacy.bank, undefined);
  assert.deepEqual(getBankBalances(null), { savings: 0, clinicalBond: 0, biotechEquity: 0 });
});

test('partial old portfolios retain valid products and default missing ones', () => {
  const legacy = player({ bank: { savings: 120_000 } as Player['bank'] });
  assert.deepEqual(getBankBalances(legacy), { savings: 120_000, clinicalBond: 0, biotechEquity: 0 });
});

test('invalid serialized balances cannot introduce negative, fractional or nonfinite money', () => {
  for (const invalid of [-1, NaN, Infinity, -Infinity, 0.25, Number.MAX_SAFE_INTEGER + 1]) {
    const corrupt = player({ bank: { savings: invalid, clinicalBond: invalid, biotechEquity: invalid } });
    assert.deepEqual(getBankBalances(corrupt), { savings: 0, clinicalBond: 0, biotechEquity: 0 });
  }
});

test('savings deposit transfers cash exactly and preserves debt', () => {
  const initial = state({ players: [player({ debt: 200_000 })] });
  const next = applyBankTransaction(initial, { type: 'deposit', product: 'savings', amount: 125_001 });
  assert.equal(next.players[0].cash, 874_999);
  assert.equal(next.players[0].debt, 200_000);
  assert.equal(next.players[0].bank?.savings, 125_001);
  assert.equal(initial.players[0].cash, 1_000_000);
});

test('a player can deposit the full available cash balance', () => {
  const next = applyBankTransaction(state(), { type: 'deposit', product: 'savings', amount: 1_000_000 });
  assert.equal(next.players[0].cash, 0);
  assert.equal(next.players[0].bank?.savings, 1_000_000);
});

test('a valid transaction initializes a legacy portfolio', () => {
  const next = applyBankTransaction(state({ players: [player({ bank: undefined })] }), {
    type: 'deposit', product: 'clinicalBond', amount: 50_000,
  });
  assert.deepEqual(next.players[0].bank, { savings: 0, clinicalBond: 50_000, biotechEquity: 0 });
});

test('deposit beyond available cash is rejected atomically', () => {
  const initial = state();
  assert.equal(applyBankTransaction(initial, { type: 'deposit', product: 'savings', amount: 1_000_001 }), initial);
});

test('repeated deposits add to the existing product balance', () => {
  let next = applyBankTransaction(state(), { type: 'deposit', product: 'savings', amount: 100_000 });
  next = applyBankTransaction(next, { type: 'deposit', product: 'savings', amount: 150_000 });
  assert.equal(next.players[0].cash, 750_000);
  assert.equal(next.players[0].bank?.savings, 250_000);
});

test('partial withdrawal transfers the exact requested amount back to cash', () => {
  const initial = state({ players: [player({ bank: { savings: 100_000, clinicalBond: 0, biotechEquity: 0 } })] });
  const next = applyBankTransaction(initial, { type: 'withdraw', product: 'savings', amount: 33_333 });
  assert.equal(next.players[0].cash, 1_033_333);
  assert.equal(next.players[0].bank?.savings, 66_667);
});

test('full withdrawal includes accrued interest and empties savings', () => {
  const accrued = accrueBankAtStart(player({ cash: 0, bank: { savings: 100_000, clinicalBond: 0, biotechEquity: 0 } })).player;
  const next = applyBankTransaction(state({ players: [accrued] }), { type: 'withdraw', product: 'savings', amount: 105_000 });
  assert.equal(next.players[0].cash, 105_000);
  assert.equal(next.players[0].bank?.savings, 0);
});

test('withdrawal beyond a product balance is rejected without partial payout', () => {
  const initial = state({ players: [player({ bank: { savings: 100, clinicalBond: 0, biotechEquity: 0 } })] });
  assert.equal(applyBankTransaction(initial, { type: 'withdraw', product: 'savings', amount: 101 }), initial);
});

test('empty products cannot be withdrawn even when another product has funds', () => {
  const initial = state({ players: [player({ bank: { savings: 100_000, clinicalBond: 0, biotechEquity: 0 } })] });
  assert.equal(applyBankTransaction(initial, { type: 'withdraw', product: 'clinicalBond', amount: 1 }), initial);
});

test('bond and equity deposits maintain separate balances', () => {
  let next = applyBankTransaction(state(), { type: 'deposit', product: 'clinicalBond', amount: 200_000 });
  next = applyBankTransaction(next, { type: 'deposit', product: 'biotechEquity', amount: 300_000 });
  assert.equal(next.players[0].cash, 500_000);
  assert.deepEqual(next.players[0].bank, { savings: 0, clinicalBond: 200_000, biotechEquity: 300_000 });
});

test('equity redemption preserves savings and clinical bonds', () => {
  const initial = state({ players: [player({ bank: { savings: 100, clinicalBond: 200, biotechEquity: 300 } })] });
  const next = applyBankTransaction(initial, { type: 'withdraw', product: 'biotechEquity', amount: 150 });
  assert.deepEqual(next.players[0].bank, { savings: 100, clinicalBond: 200, biotechEquity: 150 });
  assert.equal(next.players[0].cash, 1_000_150);
});

test('bank transactions affect only the active player and preserve other player references', () => {
  const initial = state({ activePlayerIndex: 1 });
  const next = applyBankTransaction(initial, { type: 'deposit', product: 'savings', amount: 100_000 });
  assert.equal(next.players[0], initial.players[0]);
  assert.equal(next.players[1].bank?.savings, 100_000);
  assert.equal(initial.players[1].bank?.savings, 0);
});

test('all financial operations reject invalid amounts, including negative repayments', () => {
  const initial = state({ players: [player({ debt: 200_000, bank: { savings: 100, clinicalBond: 0, biotechEquity: 0 } })] });
  for (const amount of [0, -1, -200_000, 0.5, NaN, Infinity, -Infinity, Number.MAX_SAFE_INTEGER + 1]) {
    assert.equal(isValidBankAmount(amount), false);
    assert.equal(applyBankTransaction(initial, { type: 'deposit', product: 'savings', amount }), initial);
    assert.equal(applyBankTransaction(initial, { type: 'withdraw', product: 'savings', amount }), initial);
    assert.equal(applyBankTransaction(initial, { type: 'borrow', amount }), initial);
    assert.equal(applyBankTransaction(initial, { type: 'repay', amount }), initial);
  }
  assert.equal(isValidBankAmount(1), true);
});

test('bank permits transactions before a roll, during building and in bank modal', () => {
  for (const phase of ['roll', 'building', 'bank_modal'] as GamePhase[]) {
    const initial = state({ phase });
    assert.equal(canUseBank(initial), true);
    assert.equal(applyBankTransaction(initial, { type: 'deposit', product: 'savings', amount: 1 }).players[0].cash, 999_999);
  }
});

test('resolution, movement, setup and completed turns reject bank transactions', () => {
  for (const phase of ['setup', 'moving', 'tile_action', 'card_modal', 'turn_end', 'game_over'] as GamePhase[]) {
    const initial = state({ phase });
    assert.equal(canUseBank(initial), false);
    assert.equal(applyBankTransaction(initial, { type: 'borrow', amount: 200_000 }), initial);
    assert.equal(applyBankTransaction(initial, { type: 'deposit', product: 'savings', amount: 1 }), initial);
  }
});

test('rolling and an announced winner reject transactions even in an otherwise valid phase', () => {
  for (const initial of [state({ isRolling: true, phase: 'roll' }), state({ winner: player() })]) {
    assert.equal(canUseBank(initial), false);
    assert.equal(applyBankTransaction(initial, { type: 'borrow', amount: 1 }), initial);
  }
});

test('missing active player and unknown products do not mutate game state', () => {
  const missing = state({ activePlayerIndex: 4 });
  assert.equal(applyBankTransaction(missing, { type: 'borrow', amount: 1 }), missing);
  const initial = state();
  for (const product of ['unknown', '__proto__', 'constructor']) {
    assert.equal(applyBankTransaction(initial, { type: 'deposit', product: product as BankProduct, amount: 1 }), initial);
  }
});

test('overflowing deposits and cash withdrawals are rejected atomically', () => {
  const fullPortfolio = state({ players: [player({ bank: { savings: Number.MAX_SAFE_INTEGER, clinicalBond: 0, biotechEquity: 0 } })] });
  assert.equal(applyBankTransaction(fullPortfolio, { type: 'deposit', product: 'savings', amount: 1 }), fullPortfolio);
  const fullWallet = state({ players: [player({ cash: Number.MAX_SAFE_INTEGER, bank: { savings: 1, clinicalBond: 0, biotechEquity: 0 } })] });
  assert.equal(applyBankTransaction(fullWallet, { type: 'withdraw', product: 'savings', amount: 1 }), fullWallet);
});

test('manual loans retain 200000 KK unit rounding', () => {
  const next = applyBankTransaction(state(), { type: 'borrow', amount: 200_001 });
  assert.equal(next.players[0].cash, 1_400_000);
  assert.equal(next.players[0].debt, 400_000);
});

test('small remaining debt can be repaid in full below the loan unit', () => {
  const initial = state({ players: [player({ cash: 50_000, debt: 50_000 })] });
  const next = applyBankTransaction(initial, { type: 'repay', amount: 50_000 });
  assert.equal(next.players[0].cash, 0);
  assert.equal(next.players[0].debt, 0);
});

test('repayment is limited by actual cash and outstanding debt', () => {
  const lowCash = state({ players: [player({ cash: 40_000, debt: 200_000 })] });
  const cashLimited = applyBankTransaction(lowCash, { type: 'repay', amount: 500_000 });
  assert.equal(cashLimited.players[0].cash, 0);
  assert.equal(cashLimited.players[0].debt, 160_000);
  const lowDebt = state({ players: [player({ cash: 200_000, debt: 40_000 })] });
  const debtLimited = applyBankTransaction(lowDebt, { type: 'repay', amount: 500_000 });
  assert.equal(debtLimited.players[0].cash, 160_000);
  assert.equal(debtLimited.players[0].debt, 0);
});

test('zero debt and zero cash cannot be used to create repayment value', () => {
  for (const initial of [state(), state({ players: [player({ cash: 0, debt: 200_000 })] })]) {
    assert.equal(applyBankTransaction(initial, { type: 'repay', amount: 1 }), initial);
  }
});

test('loan and repayment reject corrupt wallet values and overflowing balances', () => {
  for (const initial of [
    state({ players: [player({ cash: NaN })] }), state({ players: [player({ debt: -1 })] }),
    state({ players: [player({ cash: Number.MAX_SAFE_INTEGER })] }),
    state({ players: [player({ debt: Number.MAX_SAFE_INTEGER })] }),
  ]) assert.equal(applyBankTransaction(initial, { type: 'borrow', amount: 200_000 }), initial);
});

test('START accrual credits savings 5% and clinical bonds 10% without changing cash or debt', () => {
  const initial = player({ debt: 200_000, bank: { savings: 100_000, clinicalBond: 200_000, biotechEquity: 0 } });
  const result = accrueBankAtStart(initial);
  assert.deepEqual(result.player.bank, { savings: 105_000, clinicalBond: 220_000, biotechEquity: 0 });
  assert.deepEqual(result.returns, { savings: 5_000, clinicalBond: 20_000, biotechEquity: 0 });
  assert.equal(result.player.cash, initial.cash);
  assert.equal(result.player.debt, initial.debt);
});

test('successive forward START crossings compound previously credited returns', () => {
  const initial = player({ bank: { savings: 10_000, clinicalBond: 10_000, biotechEquity: 0 } });
  const twice = accrueBankAtStart(accrueBankAtStart(initial).player).player;
  assert.deepEqual(twice.bank, { savings: 11_025, clinicalBond: 12_100, biotechEquity: 0 });
});

for (const [sample, expected] of [[0, 90_000], [0.2, 95_000], [0.4, 100_000], [0.6, 110_000], [0.99999, 120_000]]) {
  test(`injected biotech RNG ${sample} produces the bounded expected balance ${expected}`, () => {
    const initial = player({ bank: { savings: 0, clinicalBond: 0, biotechEquity: 100_000 } });
    const result = accrueBankAtStart(initial, () => sample);
    assert.equal(result.player.bank?.biotechEquity, expected);
    assert.equal(result.returns.biotechEquity, expected - 100_000);
  });
}

test('invalid random samples safely produce a neutral biotech period', () => {
  for (const sample of [-1, 1, NaN, Infinity]) {
    const result = accrueBankAtStart(player({ bank: { savings: 0, clinicalBond: 0, biotechEquity: 100_000 } }), () => sample);
    assert.equal(result.player.bank?.biotechEquity, 100_000);
    assert.equal(result.biotechRate, 0);
  }
});

test('empty biotech account consumes no random sample', () => {
  let samples = 0;
  accrueBankAtStart(player(), () => { samples += 1; return 0; });
  assert.equal(samples, 0);
});

test('fractional returns round to the nearest whole KK, including losses', () => {
  const result = accrueBankAtStart(player({ bank: { savings: 10, clinicalBond: 15, biotechEquity: 15 } }), () => 0);
  assert.deepEqual(result.player.bank, { savings: 11, clinicalBond: 17, biotechEquity: 14 });
});

test('returns never overflow the safe integer balance limit', () => {
  const maximum = Number.MAX_SAFE_INTEGER;
  const result = accrueBankAtStart(player({ bank: { savings: maximum, clinicalBond: maximum, biotechEquity: maximum } }), () => 0.99);
  assert.deepEqual(result.player.bank, { savings: maximum, clinicalBond: maximum, biotechEquity: maximum });
});

test('a forward move that lands exactly on START accrues once', () => {
  const initial = player({ position: 35, bank: { savings: 100_000, clinicalBond: 0, biotechEquity: 0 } });
  assert.equal(accrueBankForMovement(initial, 1).player.bank?.savings, 105_000);
});

test('forward card movement across START uses the same accrual as a dice crossing', () => {
  const initial = player({ position: 34, bank: { savings: 100_000, clinicalBond: 0, biotechEquity: 0 } });
  assert.equal(accrueBankForMovement(initial, 3).player.bank?.savings, 105_000);
});

test('processing START landing after the movement cannot accrue the same return twice', () => {
  const moved = accrueBankForMovement(player({ position: 35, bank: { savings: 100_000, clinicalBond: 0, biotechEquity: 0 } }), 1).player;
  const landed = { ...moved, position: 0 };
  const resolved = accrueBankForMovement(landed, 0);
  assert.equal(resolved.player, landed);
  assert.equal(resolved.player.bank?.savings, 105_000);
  assert.deepEqual(resolved.returns, { savings: 0, clinicalBond: 0, biotechEquity: 0 });
});

test('backward movement and moves that stop before START earn no return', () => {
  for (const [position, steps] of [[0, -1], [3, -4], [30, 5], [0, 6]]) {
    const initial = player({ position, bank: { savings: 100_000, clinicalBond: 0, biotechEquity: 0 } });
    assert.equal(accrueBankForMovement(initial, steps).player, initial);
  }
});

test('malformed or unbounded movement cannot produce repeated interest', () => {
  for (const steps of [NaN, Infinity, 0.5, 37, Number.MAX_SAFE_INTEGER]) {
    const initial = player({ position: 35, bank: { savings: 100_000, clinicalBond: 0, biotechEquity: 0 } });
    assert.equal(accrueBankForMovement(initial, steps).player, initial);
  }
});

test('a START card from another tile earns one period; a jump from START to itself earns none', () => {
  const initial = player({ position: 9, bank: { savings: 100_000, clinicalBond: 0, biotechEquity: 0 } });
  assert.equal(accrueBankForMovement(initial, 36 - initial.position).player.bank?.savings, 105_000);
  const alreadyAtStart = { ...initial, position: 0 };
  assert.equal(accrueBankForMovement(alreadyAtStart, 0).player, alreadyAtStart);
});

test('bank transactions and accrual leave frozen input portfolios unchanged', () => {
  const initial = state();
  Object.freeze(initial.players[0].bank);
  Object.freeze(initial.players[0]);
  const next = applyBankTransaction(initial, { type: 'deposit', product: 'savings', amount: 100_000 });
  Object.freeze(next.players[0].bank);
  const accrued = accrueBankAtStart(next.players[0]);
  assert.equal(next.players[0].bank?.savings, 100_000);
  assert.equal(accrued.player.bank?.savings, 105_000);
});

test('portfolios survive GameState JSON serialization for multiplayer synchronization', () => {
  const next = applyBankTransaction(state(), { type: 'deposit', product: 'biotechEquity', amount: 123_456 });
  const remote = JSON.parse(JSON.stringify(next)) as GameState;
  assert.deepEqual(getBankBalances(remote.players[0]), { savings: 0, clinicalBond: 0, biotechEquity: 123_456 });
  assert.equal(remote.players[0].cash, 876_544);
  assert.equal(remote.players[1].cash, 1_000_000);
});
