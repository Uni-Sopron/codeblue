import React from 'react';
import type { Tile as TileData, Player } from '../../types/game.ts';
import { TileIcon } from '../Common/TileIcon.tsx';
import { PlayerPawn } from './PlayerPawn.tsx';
import './Tile.css';

interface TileProps {
  tile: TileData;
  pawns: Player[];
  activePlayerId?: string;
  isTargetTile?: boolean;
  onClick?: () => void;
}

export const Tile: React.FC<TileProps> = ({
  tile,
  pawns,
  activePlayerId,
  isTargetTile = false,
  onClick,
}) => {
  const formatCurrency = (val: number) => {
    return `${val.toLocaleString('hu-HU')} KK`;
  };

  const getTypeThemeClass = () => {
    switch (tile.type) {
      case 'start':
        return 'tile-start';
      case 'income':
        return 'tile-income';
      case 'expense':
        return 'tile-expense';
      case 'card':
        return 'tile-card';
      case 'purchase':
        return 'tile-purchase';
      case 'special':
        return 'tile-special';
      case 'neutral':
      default:
        return 'tile-neutral';
    }
  };

  return (
    <div
      className={`board-tile ${getTypeThemeClass()} ${isTargetTile ? 'tile-targeted' : ''}`}
      onClick={onClick}
      title={`${tile.name}\n${tile.description}`}
    >
      {/* Top Header: Tile Index and Icon */}
      <div className="tile-header">
        <span className="tile-index">{tile.id}</span>
        <div className="tile-icon-wrapper">
          <TileIcon name={tile.icon} size={16} />
        </div>
      </div>

      {/* Center: Title */}
      <div className="tile-body">
        <span className="tile-name">{tile.name}</span>
      </div>

      {/* Bottom: Value Pill if applicable */}
      {tile.value !== undefined && (
        <div className="tile-footer">
          <span className={`tile-value-badge ${tile.type === 'income' || tile.type === 'start' ? 'badge-pos' : 'badge-neg'}`}>
            {tile.type === 'income' || tile.type === 'start' ? '+' : '-'}
            {formatCurrency(tile.value)}
          </span>
        </div>
      )}

      {/* Pawn Container (Multi-pawn cluster) */}
      {pawns.length > 0 && (
        <div className={`tile-pawns-container pawns-count-${pawns.length}`}>
          {pawns.map((pawn) => (
            <PlayerPawn
              key={pawn.id}
              player={pawn}
              isCurrentTurn={pawn.id === activePlayerId}
              size={pawns.length > 2 ? 'sm' : 'md'}
            />
          ))}
        </div>
      )}

      {/* Target Tile Highlight Glow */}
      {isTargetTile && <div className="tile-glow-border" />}
    </div>
  );
};
