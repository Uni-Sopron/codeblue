import type { Player, PlayerId } from '../types/game.ts';

interface SkippedTurn {
  playerId: PlayerId;
  playerName: string;
  turnNumber: number;
  remainingTurns: number;
}

export function getNextTurn(players: readonly Player[], activePlayerIndex: number, turnNumber: number): {
  players: Player[];
  activePlayerIndex: number;
  turnNumber: number;
  skippedTurns: SkippedTurn[];
} | null {
  if (!players.length || players.every((player) => player.eliminated)) return null;

  const updatedPlayers = [...players];
  const skippedTurns: SkippedTurn[] = [];
  let nextIndex = activePlayerIndex;
  let nextTurnNumber = turnNumber;

  while (true) {
    nextIndex = (nextIndex + 1) % updatedPlayers.length;
    if (nextIndex === 0) nextTurnNumber += 1;

    const player = updatedPlayers[nextIndex];
    if (player.eliminated) continue;
    if (player.skipTurns > 0) {
      const remainingTurns = player.skipTurns - 1;
      updatedPlayers[nextIndex] = { ...player, skipTurns: remainingTurns };
      skippedTurns.push({ playerId: player.id, playerName: player.name, turnNumber: nextTurnNumber, remainingTurns });
      continue;
    }

    return { players: updatedPlayers, activePlayerIndex: nextIndex, turnNumber: nextTurnNumber, skippedTurns };
  }
}
