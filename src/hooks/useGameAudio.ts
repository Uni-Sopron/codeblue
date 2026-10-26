import { useCallback, useEffect, useRef, useSyncExternalStore } from 'react';
import type { GameState, PlayerId } from '../types/game.ts';
import {
  getSoundEnabled,
  playSound,
  registerAudioUnlock,
  setSoundEnabled,
  subscribeSoundEnabled,
} from '../utils/audio.ts';
import type { SoundEffect } from '../utils/audio.ts';

interface AudioSnapshot {
  phase: GameState['phase'];
  turnNumber: number;
  isRolling: boolean;
  cardId: number | null;
  hasWinner: boolean;
  cashByPlayer: Map<PlayerId, number>;
}

/** Csak a React által már alkalmazott játékesemények kapnak hangot. */
export function useGameAudio(gameState: GameState) {
  const soundEnabled = useSyncExternalStore(subscribeSoundEnabled, getSoundEnabled, () => true);
  const previousSnapshot = useRef<AudioSnapshot | null>(null);

  useEffect(() => registerAudioUnlock(), []);

  useEffect(() => {
    const previous = previousSnapshot.current;
    const current: AudioSnapshot = {
      phase: gameState.phase,
      turnNumber: gameState.turnNumber,
      isRolling: gameState.isRolling,
      cardId: gameState.drawnCard?.id ?? null,
      hasWinner: gameState.winner !== null || gameState.phase === 'game_over',
      cashByPlayer: new Map(gameState.players.map((player) => [player.id, player.cash])),
    };

    // A pillanatkép lejátszás előtt frissül, ezért StrictMode alatt sem ismétlődik a hang.
    previousSnapshot.current = current;
    if (!previous || previous.phase === 'setup' || current.phase === 'setup') return;

    if (current.hasWinner && !previous.hasWinner) {
      void playSound('victory');
      return;
    }
    if (current.isRolling && !previous.isRolling) void playSound('dice');
    if (current.phase === 'card_modal' && current.cardId !== null
      && (previous.phase !== 'card_modal' || previous.cardId !== current.cardId)) {
      void playSound('card');
    }

    const samePlayers = current.cashByPlayer.size === previous.cashByPlayer.size
      && [...current.cashByPlayer.keys()].every((id) => previous.cashByPlayer.has(id));
    const newGame = previous.hasWinner || current.turnNumber < previous.turnNumber;
    if (!samePlayers || newGame) return;

    // A soron következő játékos váltása önmagában nem pénzmozgás.
    const cashChanged = [...current.cashByPlayer].some(([id, cash]) => previous.cashByPlayer.get(id) !== cash);
    if (cashChanged) void playSound('money');
  }, [gameState]);

  const previewSound = useCallback((effect: SoundEffect) => {
    void playSound(effect);
  }, []);

  return { soundEnabled, setSoundEnabled, previewSound };
}
