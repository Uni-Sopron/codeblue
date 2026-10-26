import type { GameState, PlayerId } from '../types/game.ts';
import { GAME_CONSTANTS } from '../types/game.ts';
import { EVENT_CARDS } from '../data/cards.ts';
import { BOARD_TILES } from '../data/tiles.ts';
import { CLINIC_ELEMENTS } from '../data/clinicElements.ts';

export type DevAction =
  | { type: 'adjust_cash'; playerId: PlayerId; amount: number }
  | { type: 'teleport'; playerId: PlayerId; tileId: number }
  | { type: 'draw_card'; cardId: number }
  | { type: 'instant_victory' };

export function canUseDevTools(state: GameState): boolean {
  return (state.phase === 'roll' || state.phase === 'building') &&
    !state.isRolling && !state.winner && !!state.players[state.activePlayerIndex];
}

/** Presentation-only transitions. Normal card effects still run in the engine. */
export function applyDevAction(state: GameState, action: DevAction): GameState {
  if (!canUseDevTools(state)) return state;

  const activePlayer = state.players[state.activePlayerIndex];
  const player = 'playerId' in action
    ? state.players.find((candidate) => candidate.id === action.playerId)
    : activePlayer;
  if (!player) return state;

  let next = state;
  let message: string;
  switch (action.type) {
    case 'adjust_cash': {
      if (Math.abs(action.amount) !== 1_000_000) return state;
      const cash = Math.max(0, player.cash + action.amount);
      if (!Number.isSafeInteger(cash) || cash === player.cash) return state;
      next = {
        ...state,
        players: state.players.map((candidate) => candidate.id === player.id
          ? { ...player, cash }
          : candidate),
      };
      message = `${player.name}: egyenleg ${cash.toLocaleString('hu-HU')} KK.`;
      break;
    }
    case 'teleport': {
      const tile = BOARD_TILES.find((candidate) => candidate.id === action.tileId);
      if (!tile || player.position === tile.id) return state;
      next = {
        ...state,
        players: state.players.map((candidate) => candidate.id === player.id
          ? { ...player, position: tile.id }
          : candidate),
      };
      // Teleportation is a position edit, not a move through START or a tile event.
      message = `${player.name}: teleport → #${tile.id} ${tile.name}.`;
      break;
    }
    case 'draw_card': {
      const card = EVENT_CARDS.find((candidate) => candidate.id === action.cardId);
      if (!card) return state;
      next = {
        ...state,
        phase: 'card_modal',
        drawnCard: card,
        // Allow deliberate re-tests without duplicating the card in either deck.
        cardDeck: state.cardDeck.filter((id) => id !== card.id),
        discardDeck: [...state.discardDeck.filter((id) => id !== card.id), card.id],
      };
      message = `${activePlayer.name}: kiválasztott eseménykártya #${card.id} – ${card.title}.`;
      break;
    }
    case 'instant_victory': {
      const winner = {
        ...activePlayer,
        builtElements: CLINIC_ELEMENTS.map((element) => element.id),
        cash: Math.max(activePlayer.cash, GAME_CONSTANTS.VICTORY_MIN_CASH),
        debt: 0,
      };
      next = {
        ...state,
        players: state.players.map((candidate, index) => index === state.activePlayerIndex
          ? winner
          : candidate),
        winner,
        phase: 'game_over',
        drawnCard: null,
      };
      message = `${winner.name}: győzelemteszt, 8 részleg, elegendő tőke és 0 KK tartozás.`;
      break;
    }
  }

  return {
    ...next,
    logs: [{
      id: `dev_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
      playerId: player.id,
      playerName: player.name,
      message: `[Zsűri teszt] ${message}`,
      timestamp: Date.now(),
      type: 'system' as const,
    }, ...state.logs].slice(0, 100),
  };
}
