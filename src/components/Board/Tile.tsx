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
  tooltipPosition?: 'top' | 'bottom' | 'left' | 'right';
  onClick?: () => void;
  onHover?: (tile: TileData | null) => void;
}

const getTypeLabel = (type: TileData['type']): string => {
  switch (type) {
    case 'start':
      return 'START';
    case 'income':
      return 'Bevétel';
    case 'expense':
      return 'Kiadás';
    case 'card':
      return 'Esemény';
    case 'purchase':
      return 'Vásárlás';
    case 'special':
      return 'Speciális';
    case 'neutral':
    default:
      return 'Pihenő';
  }
};

export const Tile: React.FC<TileProps> = ({
  tile,
  pawns,
  activePlayerId,
  isTargetTile = false,
  tooltipPosition = 'bottom',
  onClick,
  onHover,
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
      onMouseEnter={() => onHover?.(tile)}
      onMouseLeave={() => onHover?.(null)}
      role="button"
      tabIndex={0}
      aria-label={`${tile.name} (Mező #${tile.id})`}
    >
      {/* Mező száma (0..35) a bal felső sarokban */}
      <span className="tile-index">{tile.id}</span>

      {/* Kategória ikon a mező közepén */}
      <div className="tile-icon-container">
        <TileIcon name={tile.icon} size={22} />
      </div>

      {/* Bábu konténer: a bábuk áttekinthetően a mező alján */}
      {pawns.length > 0 && (
        <div className={`tile-pawns-container pawns-count-${pawns.length}`}>
          {pawns.map((pawn) => (
            <PlayerPawn
              key={pawn.id}
              player={pawn}
              isCurrentTurn={pawn.id === activePlayerId}
              size={pawns.length >= 3 ? 'xs' : pawns.length === 2 ? 'sm' : 'md'}
            />
          ))}
        </div>
      )}

      {/* Célmező kiemelése (aktív játékos helyzete) */}
      {isTargetTile && <div className="tile-glow-border" />}

      {/* Letisztult lebegő tooltip rámutatáskor (hover) */}
      <div className={`tile-tooltip tooltip-${tooltipPosition}`} role="tooltip">
        <div className="tooltip-top-row">
          <span className="tooltip-id">#{tile.id}</span>
          <span className={`tooltip-type-badge badge-${tile.type}`}>
            {getTypeLabel(tile.type)}
          </span>
          {tile.value !== undefined && (
            <span
              className={`tooltip-val-badge ${
                tile.type === 'income' || tile.type === 'start' ? 'val-pos' : 'val-neg'
              }`}
            >
              {tile.type === 'income' || tile.type === 'start' ? '+' : '-'}
              {formatCurrency(tile.value)}
            </span>
          )}
        </div>
        <div className="tooltip-title">{tile.name}</div>
        <div className="tooltip-desc">{tile.description}</div>
      </div>
    </div>
  );
};