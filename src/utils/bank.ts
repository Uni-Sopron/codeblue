import type { BankBalances, BankProduct, GameState, Player } from '../types/game.ts';
import { GAME_CONSTANTS } from '../types/game.ts';

export const BANK_RATES = { savings: 0.03, clinicalBond: 0.07 } as const;
export const CLINICAL_BOND_LOCK_ROUNDS = 7;
export const BIOTECH_RETURNS = [-0.08, -0.04, 0, 0.06, 0.12, 0.15] as const;
export const BANK_PRODUCTS: readonly BankProduct[] = ['savings', 'clinicalBond', 'biotechEquity'];

export type BankTransaction =
  | { type: 'deposit' | 'withdraw'; product: BankProduct; amount: number }
  | { type: 'borrow' | 'repay'; amount: number };

export interface BankAccrual {
  player: Player;
  returns: BankBalances;
  biotechRate: number | null;
}

const zeroBalances = (): BankBalances => ({ savings: 0, clinicalBond: 0, biotechEquity: 0 });
const validBalance = (value: number): boolean => Number.isSafeInteger(value) && value >= 0;

export function isValidBankAmount(amount: number): boolean {
  return Number.isSafeInteger(amount) && amount > 0;
}

/** A korábbi mentések és a régebbi online kliensek hiányzó mezői nullát jelentenek. */
export function getBankBalances(player: Pick<Player, 'bank'> | null | undefined): BankBalances {
  const balances = zeroBalances();
  for (const product of BANK_PRODUCTS) {
    const value = player?.bank?.[product];
    if (typeof value === 'number' && validBalance(value)) balances[product] = value;
  }
  return balances;
}

export function canUseBank(state: GameState): boolean {
  return !state.isRolling && !state.winner
    && (state.phase === 'roll' || state.phase === 'building' || state.phase === 'bank_modal')
    && !!state.players[state.activePlayerIndex];
}

/** Tiszta állapotátmenet: az ellenőrzés mindig az aktuális állapotból történik. */
export function applyBankTransaction(state: GameState, action: BankTransaction): GameState {
  if (!canUseBank(state) || !isValidBankAmount(action.amount)) return state;
  const player = state.players[state.activePlayerIndex];
  if (!validBalance(player.cash) || !validBalance(player.debt)) return state;

  const bank = getBankBalances(player);
  let cash = player.cash;
  let debt = player.debt;
  let bondLockTurns = player.bondLockTurns ?? 0;
  switch (action.type) {
    case 'deposit':
      if (!BANK_PRODUCTS.includes(action.product) || action.amount > cash
        || !validBalance(bank[action.product] + action.amount)) return state;
      bank[action.product] += action.amount;
      cash -= action.amount;
      if (action.product === 'clinicalBond') {
        bondLockTurns = CLINICAL_BOND_LOCK_ROUNDS;
      }
      break;
    case 'withdraw':
      if (!BANK_PRODUCTS.includes(action.product) || action.amount > bank[action.product]
        || !validBalance(cash + action.amount)) return state;
      if (action.product === 'clinicalBond' && bondLockTurns > 0) return state;
      bank[action.product] -= action.amount;
      cash += action.amount;
      if (action.product === 'clinicalBond' && bank.clinicalBond === 0) {
        bondLockTurns = 0;
      }
      break;
    case 'borrow': {
      const rounded = Math.ceil(action.amount / GAME_CONSTANTS.LOAN_UNIT) * GAME_CONSTANTS.LOAN_UNIT;
      if (!isValidBankAmount(rounded) || !validBalance(cash + rounded)
        || !validBalance(debt + rounded)) return state;
      cash += rounded;
      debt += rounded;
      break;
    }
    case 'repay': {
      const actual = Math.min(action.amount, cash, debt);
      if (!isValidBankAmount(actual)) return state;
      cash -= actual;
      debt -= actual;
      break;
    }
    default:
      return state;
  }

  const players = [...state.players];
  players[state.activePlayerIndex] = { ...player, cash, debt, bank, bondLockTurns };
  return { ...state, players };
}

/** Egész KK-ra kerekítés; a nagy egyenlegek sem veszítenek pontosságot szorzáskor. */
function balanceAfterReturn(balance: number, percent: number): number {
  const rounded = (BigInt(balance) * BigInt(100 + percent) + 50n) / 100n;
  return Number(rounded > BigInt(Number.MAX_SAFE_INTEGER) ? BigInt(Number.MAX_SAFE_INTEGER) : rounded);
}

/** Egyetlen valódi START-áthaladás hozama; a véletlen a tesztekből befecskendezhető. */
export function accrueBankAtStart(player: Player, random: () => number = Math.random): BankAccrual {
  const before = getBankBalances(player);
  const bank = { ...before };
  let biotechRate: number | null = null;
  bank.savings = balanceAfterReturn(before.savings, 3);
  bank.clinicalBond = balanceAfterReturn(before.clinicalBond, 7);
  if (before.biotechEquity > 0) {
    const sample = random();
    // Sérült RNG esetén 0%: a hibás bemenetből nem származhat szélsőséges hozam.
    const rate = Number.isFinite(sample) && sample >= 0 && sample < 1
      ? BIOTECH_RETURNS[Math.floor(sample * BIOTECH_RETURNS.length)]
      : 0;
    biotechRate = rate;
    bank.biotechEquity = balanceAfterReturn(before.biotechEquity, Math.round(rate * 100));
  }
  return {
    player: { ...player, bank },
    returns: {
      savings: bank.savings - before.savings,
      clinicalBond: bank.clinicalBond - before.clinicalBond,
      biotechEquity: bank.biotechEquity - before.biotechEquity,
    },
    biotechRate,
  };
}

/** A sima START-ra érkezés feldolgozása nem új áthaladás, ezért steps=0 nem kamatozik. */
export function accrueBankForMovement(
  player: Player,
  forwardSteps: number,
  random: () => number = Math.random,
): BankAccrual {
  if (!Number.isInteger(player.position) || player.position < 0
    || player.position >= GAME_CONSTANTS.TOTAL_TILES || !isValidBankAmount(forwardSteps)
    || forwardSteps > GAME_CONSTANTS.TOTAL_TILES
    || player.position + forwardSteps < GAME_CONSTANTS.TOTAL_TILES) {
    return { player, returns: zeroBalances(), biotechRate: null };
  }
  return accrueBankAtStart(player, random);
}
