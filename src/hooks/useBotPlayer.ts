import { useEffect, useEffectEvent, useMemo } from 'react';
import type { useGameEngine } from './useGameEngine.ts';
import { chooseBotAction, getBotDelay } from '../utils/botStrategy.ts';

type BotEngine = Pick<ReturnType<typeof useGameEngine>,
  'gameState' | 'hasBuiltThisTurn' | 'hasRolledThisTurn' | 'extraRollAvailable' | 'canBuyElement'
  | 'rollDice' | 'resolveTileAction' | 'resolveCardAction' | 'buyClinicElement' | 'repayLoan'
  | 'withdrawBank' | 'depositBank' | 'endTurn'>;

interface BotPlayerOptions {
  enabled: boolean;
  paused: boolean;
}

/** Helyben a játék, online kizárólag a host böngészője futtatja ezt az egy időzítőt. */
export function useBotPlayer(engine: BotEngine, { enabled, paused }: BotPlayerOptions): void {
  const { gameState, hasBuiltThisTurn, hasRolledThisTurn, extraRollAvailable, canBuyElement } = engine;
  const action = useMemo(() => chooseBotAction({
    gameState, hasBuiltThisTurn, hasRolledThisTurn, extraRollAvailable, canBuyElement,
  }), [gameState, hasBuiltThisTurn, hasRolledThisTurn, extraRollAvailable, canBuyElement]);
  const actionKey = action ? JSON.stringify(action) : '';

  const execute = useEffectEvent((scheduledState: typeof gameState, scheduledAction: string) => {
    // A régi körhöz vagy meccshez tartozó késleltetett művelet nem nyúlhat az új állapothoz.
    if (!enabled || paused || engine.gameState !== scheduledState) return;
    const currentAction = chooseBotAction(engine);
    if (!currentAction || JSON.stringify(currentAction) !== scheduledAction) return;
    switch (currentAction.type) {
      case 'roll': engine.rollDice(); break;
      case 'resolve_tile': engine.resolveTileAction(); break;
      case 'resolve_card': engine.resolveCardAction(); break;
      case 'buy': engine.buyClinicElement(currentAction.elementId); break;
      case 'repay': engine.repayLoan(currentAction.amount); break;
      case 'withdraw': engine.withdrawBank(currentAction.product, currentAction.amount); break;
      case 'deposit': engine.depositBank(currentAction.product, currentAction.amount); break;
      case 'end_turn': engine.endTurn(); break;
    }
  });

  useEffect(() => {
    if (!enabled || paused || !actionKey) return;
    const timer = window.setTimeout(() => execute(gameState, actionKey), getBotDelay());
    return () => window.clearTimeout(timer);
  }, [enabled, paused, gameState, actionKey]);
}
