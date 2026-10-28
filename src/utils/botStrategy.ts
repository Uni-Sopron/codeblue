import type { BankProduct, ClinicElementId, GameState, Player } from '../types/game.ts';
import { GAME_CONSTANTS } from '../types/game.ts';
import { CLINIC_ELEMENTS } from '../data/clinicElements.ts';
import { BANK_PRODUCTS, getBankBalances } from './bank.ts';

export const BOT_CASH_RESERVE = 150_000;

export type BotAction =
  | { type: 'roll' }
  | { type: 'resolve_tile' }
  | { type: 'resolve_card' }
  | { type: 'buy'; elementId: ClinicElementId }
  | { type: 'repay'; amount: number }
  | { type: 'withdraw'; product: BankProduct; amount: number }
  | { type: 'deposit'; product: BankProduct; amount: number }
  | { type: 'end_turn' };

export interface BotStrategyContext {
  gameState: GameState;
  hasBuiltThisTurn: boolean;
  hasRolledThisTurn: boolean;
  extraRollAvailable: boolean;
  canBuyElement: (id: ClinicElementId) => { canBuy: boolean; finalCost: number };
}

/** Rögzített bemenettel megismételhető, 1–1,5 másodperces gondolkodási idő. */
export function getBotDelay(random: () => number = Math.random): number {
  const sample = random();
  return Number.isFinite(sample) && sample >= 0 && sample < 1
    ? 1_000 + Math.floor(sample * 501)
    : 1_250;
}

function unlockedDescendants(elementId: ClinicElementId, built: readonly string[]): number {
  const descendants = new Set<ClinicElementId>();
  const visit = (id: ClinicElementId) => {
    for (const candidate of CLINIC_ELEMENTS) {
      if (candidate.prerequisiteId === id && !descendants.has(candidate.id)) {
        descendants.add(candidate.id);
        visit(candidate.id);
      }
    }
  };
  visit(elementId);
  return [...descendants].filter((id) => !built.includes(id)).length;
}

function buildOptions(player: Player, canBuyElement: BotStrategyContext['canBuyElement']) {
  return CLINIC_ELEMENTS
    .filter((element) => !player.builtElements.includes(element.id)
      && (!element.prerequisiteId || player.builtElements.includes(element.prerequisiteId)))
    .map((element) => ({ element, check: canBuyElement(element.id), unlocks: unlockedDescendants(element.id, player.builtElements) }))
    .filter(({ check }) => Number.isSafeInteger(check.finalCost) && check.finalCost >= 0)
    .sort((left, right) => right.unlocks - left.unlocks
      || left.check.finalCost - right.check.finalCost || left.element.order - right.element.order);
}

/** Előnyben részesül a legtöbb további részleget megnyitó szárny, majd az olcsóbb. */
export function chooseBotBuild(player: Player, canBuyElement: BotStrategyContext['canBuyElement']): ClinicElementId | null {
  return buildOptions(player, canBuyElement)
    .find(({ check }) => check.canBuy && player.cash - check.finalCost >= BOT_CASH_RESERVE)?.element.id ?? null;
}

function withdrawToward(player: Player, targetCash: number): BotAction | null {
  if (player.cash >= targetCash) return null;
  const bank = getBankBalances(player);
  for (const product of BANK_PRODUCTS) {
    const amount = Math.min(bank[product], targetCash - player.cash);
    if (Number.isSafeInteger(amount) && amount > 0) return { type: 'withdraw', product, amount };
  }
  return null;
}

/** Egy döntés egy állapotátmenetet indít; nincs ciklus, hitelből építkezés vagy tartalékfelélés. */
export function chooseBotAction(context: BotStrategyContext): BotAction | null {
  const { gameState: state, hasBuiltThisTurn, hasRolledThisTurn, extraRollAvailable, canBuyElement } = context;
  const player = state.players[state.activePlayerIndex];
  if (!player?.isAI || state.winner || state.isRolling || state.phase === 'game_over'
    || !Number.isSafeInteger(player.cash) || player.cash < 0
    || !Number.isSafeInteger(player.debt) || player.debt < 0) return null;

  switch (state.phase) {
    case 'roll': {
      const canRoll = !hasRolledThisTurn || extraRollAvailable || Boolean(state.extraRollAvailable);
      return canRoll ? { type: 'roll' } : null;
    }
    case 'tile_action':
      return { type: 'resolve_tile' };
    case 'card_modal':
      return { type: 'resolve_card' };
    case 'turn_end':
      return { type: 'end_turn' };
    case 'building':
    case 'bank_modal': {
      const complete = CLINIC_ELEMENTS.every((element) => player.builtElements.includes(element.id));
      const repayable = Math.min(player.debt, Math.max(0, player.cash - BOT_CASH_RESERVE));
      if (repayable > 0) return { type: 'repay', amount: repayable };
      if (player.debt > 0) {
        const withdrawal = withdrawToward(player, Math.min(Number.MAX_SAFE_INTEGER, player.debt + BOT_CASH_RESERVE));
        if (withdrawal) return withdrawal;
      }
      if (complete) {
        const withdrawal = withdrawToward(player, GAME_CONSTANTS.VICTORY_MIN_CASH);
        return withdrawal ?? { type: 'end_turn' };
      }
      if (!hasBuiltThisTurn && !state.builtThisTurn && state.phase === 'building') {
        const elementId = chooseBotBuild(player, canBuyElement);
        if (elementId) return { type: 'buy', elementId };
        const bank = getBankBalances(player);
        const wealth = player.cash + bank.savings + bank.clinicalBond + bank.biotechEquity;
        const target = buildOptions(player, canBuyElement)
          .find(({ check }) => check.finalCost + BOT_CASH_RESERVE <= wealth);
        if (target) {
          const withdrawal = withdrawToward(player, target.check.finalCost + BOT_CASH_RESERVE);
          if (withdrawal) return withdrawal;
        }
      }

      // Likvid többlettőke lekötése a Bankban: építkezés után, ha maradt jelentős felesleg
      if ((hasBuiltThisTurn || state.builtThisTurn) && player.builtElements.length > 0 && !complete && state.phase === 'building') {
        const surplus = player.cash - BOT_CASH_RESERVE;
        if (player.debt === 0 && surplus >= 200_000) {
          const depositAmount = Math.min(200_000, Math.floor(surplus / 100_000) * 100_000);
          if (depositAmount > 0) {
            return { type: 'deposit', product: 'savings', amount: depositAmount };
          }
        }
      }

      return { type: 'end_turn' };
    }
    default:
      return null;
  }
}
