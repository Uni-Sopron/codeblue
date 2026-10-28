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
  builtCountByPlayer: Map<PlayerId, number>;
  positionByPlayer: Map<PlayerId, number>;
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
      builtCountByPlayer: new Map(gameState.players.map((player) => [player.id, player.builtElements.length])),
      positionByPlayer: new Map(gameState.players.map((player) => [player.id, player.position])),
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

    // Szirénázó Rohammentő mezőre (#4) lépés hangjelzése
    const landedOnSiren = [...current.positionByPlayer].some(([id, pos]) => (
      pos === 4 && previous.positionByPlayer.get(id) !== 4
    ));
    if (landedOnSiren) void playSound('siren');

    const samePlayers = current.cashByPlayer.size === previous.cashByPlayer.size
      && [...current.cashByPlayer.keys()].every((id) => previous.cashByPlayer.has(id));
    const newGame = previous.hasWinner || current.turnNumber < previous.turnNumber;
    if (!samePlayers || newGame) return;

    // Új klinikai részleg megépítésekor a triumfáló 'build' hang szólal meg
    const builtDepartment = [...current.builtCountByPlayer].some(([id, count]) => (
      count > (previous.builtCountByPlayer.get(id) ?? 0)
    ));
    if (builtDepartment) {
      void playSound('build');
      return;
    }

    // Megkülönböztetett pénzmozgás: tiszta bevétel ('money') vs. kiadás/bírság ('penalty')
    let netGain = 0;
    let netLoss = 0;
    for (const [id, cash] of current.cashByPlayer) {
      const prev = previous.cashByPlayer.get(id) ?? cash;
      if (cash > prev) netGain += (cash - prev);
      else if (cash < prev) netLoss += (prev - cash);
    }

    if (netGain > 0 && netGain >= netLoss) {
      void playSound('money');
    } else if (netLoss > 0) {
      void playSound('penalty');
    }
  }, [gameState]);

  const previewSound = useCallback((effect: SoundEffect) => {
    void playSound(effect);
  }, []);

  return { soundEnabled, setSoundEnabled, previewSound };
}
