import React from 'react';
import type { Player } from '../../types/game.ts';
import { getAvatarById } from '../../data/avatars.ts';
import './PlayerPawn.css';

interface PlayerPawnProps {
  player: Player;
  isCurrentTurn?: boolean;
  size?: 'xs' | 'sm' | 'md' | 'lg';
  className?: string;
}

export const PlayerPawn: React.FC<PlayerPawnProps> = ({
  player,
  isCurrentTurn = false,
  size = 'md',
  className = '',
}) => {
  const avatarInfo = getAvatarById(player.avatar);

  return (
    <div
      className={`player-pawn pawn-${size} ${isCurrentTurn ? 'pawn-active' : ''} ${className}`}
      style={{
        borderColor: player.color,
        boxShadow: isCurrentTurn
          ? `0 0 12px ${player.color}, 0 0 20px rgba(0, 180, 216, 0.5)`
          : `0 2px 6px rgba(0, 0, 0, 0.4)`,
      }}
      title={`${player.name} (${avatarInfo?.title || player.avatarTitle})`}
    >
      {avatarInfo?.image ? (
        <img
          src={avatarInfo.image}
          alt={player.name}
          className="pawn-image"
          onError={(e) => {
            // Fallback if image path issues
            (e.target as HTMLElement).style.display = 'none';
          }}
        />
      ) : (
        <div
          className="pawn-fallback"
          style={{ backgroundColor: player.color }}
        >
          {player.name.charAt(0).toUpperCase()}
        </div>
      )}

      {/* Active Turn Pulsing Indicator */}
      {isCurrentTurn && <span className="pawn-pulse-ring" style={{ borderColor: player.color }} />}
    </div>
  );
};
