import React from 'react';
import type { Tile as TileType, Player } from '../../types/game.ts';
import { getAvatarById } from '../../data/avatars.ts';
import { Tile } from './Tile.tsx';
import { TileIcon } from '../Common/TileIcon.tsx';
import { DiceRoller } from '../Dice/DiceRoller.tsx';
import './GameBoard.css';

interface GameBoardProps {
  tiles: TileType[];
  players: Player[];
  activePlayerIndex: number;
  diceResult: number | null;
  isRolling: boolean;
  isMoving: boolean;
  onRollDice: (result: number) => void;
  onTileClick?: (tile: TileType) => void;
  statusMessage?: string;
  isRollDisabled?: boolean;
}

const getTileGridStyle = (index: number): React.CSSProperties => {
  // Top row: 0 to 9
  if (index >= 0 && index <= 9) {
    return {
      gridRow: 1,
      gridColumn: index + 1,
    };
  }
  // Right col: 10 to 17
  if (index >= 10 && index <= 17) {
    return {
      gridRow: index - 10 + 2,
      gridColumn: 10,
    };
  }
  // Bottom row: 18 to 27 (right to left)
  if (index >= 18 && index <= 27) {
    return {
      gridRow: 10,
      gridColumn: 10 - (index - 18),
    };
  }
  // Left col: 28 to 35 (bottom to top)
  if (index >= 28 && index <= 35) {
    return {
      gridRow: 9 - (index - 28),
      gridColumn: 1,
    };
  }
  return {};
};

const getTooltipPosition = (index: number): 'bottom' | 'left' | 'top' | 'right' => {
  if (index >= 0 && index <= 9) return 'bottom';
  if (index >= 10 && index <= 17) return 'left';
  if (index >= 18 && index <= 27) return 'top';
  return 'right';
};

const getTypeLabel = (type: TileType['type']): string => {
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

export const GameBoard: React.FC<GameBoardProps> = ({
  tiles,
  players,
  activePlayerIndex,
  diceResult,
  isRolling,
  isMoving,
  onRollDice,
  onTileClick,
  statusMessage,
  isRollDisabled = false,
}) => {
  const activePlayer = players[activePlayerIndex];
  const activeAvatar = activePlayer ? getAvatarById(activePlayer.avatar) : undefined;
  const currentTile = activePlayer ? tiles[activePlayer.position] : undefined;

  const [hoveredTile, setHoveredTile] = React.useState<TileType | null>(null);
  const [selectedTile, setSelectedTile] = React.useState<TileType | null>(null);

  // Group players by their current tile position
  const pawnsByTile = React.useMemo(() => {
    const map = new Map<number, Player[]>();
    for (const player of players) {
      const list = map.get(player.position) || [];
      list.push(player);
      map.set(player.position, list);
    }
    return map;
  }, [players]);

  const handleTileClick = (tile: TileType) => {
    setSelectedTile(tile);
    onTileClick?.(tile);
  };

  // Az aktív vagy megtekintett mező meghatározása a középső kártyához
  const displayedTile = hoveredTile || (selectedTile && selectedTile.id !== currentTile?.id ? selectedTile : currentTile);

  return (
    <div className="game-board-wrapper">
      <div className="game-board-grid">
        {/* Render 36 Perimeter Tiles (Minimalist Icons & Index) */}
        {tiles.map((tile) => {
          const pawnsOnTile = pawnsByTile.get(tile.id) || [];
          const isTarget = activePlayer?.position === tile.id;

          return (
            <div
              key={tile.id}
              className="grid-tile-cell"
              style={getTileGridStyle(tile.id)}
            >
              <Tile
                tile={tile}
                pawns={pawnsOnTile}
                activePlayerId={activePlayer?.id}
                isTargetTile={isTarget}
                tooltipPosition={getTooltipPosition(tile.id)}
                onClick={() => handleTileClick(tile)}
                onHover={setHoveredTile}
              />
            </div>
          );
        })}

        {/* Center Board Area (Rows 2 to 9, Cols 2 to 9) */}
        <div className="board-center-area">
          {/* Background Illustration & Overlay */}
          <div className="board-center-bg">
            <img
              src="/assets/board_center.jpg"
              alt="CodeBlue Magánklinika"
              className="center-bg-img"
            />
            <div className="center-bg-overlay" />
          </div>

          {/* Central Interactive Hub */}
          <div className="center-content">
            {/* Active Turn HUD */}
            {activePlayer && (
              <div
                className="center-turn-card"
                style={{ borderColor: activePlayer.color }}
              >
                <div className="turn-card-avatar-wrapper">
                  {activeAvatar?.image && (
                    <img
                      src={activeAvatar.image}
                      alt={activePlayer.name}
                      className="turn-card-avatar"
                      style={{ borderColor: activePlayer.color }}
                    />
                  )}
                </div>

                <div className="turn-card-info">
                  <div className="turn-label">SORON KÖVETKEZIK:</div>
                  <div className="turn-player-name" style={{ color: activePlayer.color }}>
                    {activePlayer.name}
                  </div>
                  <div className="turn-player-role">
                    {activeAvatar?.title} • {activePlayer.cash.toLocaleString('hu-HU')} KK
                  </div>
                </div>
              </div>
            )}

            {/* Center Dice Roller */}
            <div className="center-dice-box">
              <DiceRoller
                onRoll={onRollDice}
                isRolling={isRolling}
                diceResult={diceResult}
                disabled={isMoving || isRolling || isRollDisabled}
                hideButton={true}
                buttonLabel={
                  isMoving
                    ? 'Lépkedés...'
                    : isRollDisabled
                    ? 'Várakozás...'
                    : 'Kockadobás'
                }
              />
            </div>

            {/* Status Message Notification if any */}
            {statusMessage && (
              <div className="center-status-alert">
                <span className="status-dot" />
                <span className="status-text">{statusMessage}</span>
              </div>
            )}

            {/* Interaktív Központi Mezőkártya (Landing / Hover / Selection Info) */}
            {displayedTile && (
              <div className={`center-landing-card landing-${displayedTile.type}`}>
                <div className="landing-card-header">
                  <div className="landing-tags">
                    <span className="landing-source-pill">
                      {hoveredTile
                        ? `Megtekintés #${displayedTile.id}`
                        : selectedTile && selectedTile.id !== currentTile?.id
                        ? `Kijelölve #${displayedTile.id}`
                        : `Aktuális mező #${displayedTile.id}`}
                    </span>
                    <span className={`landing-type-pill pill-${displayedTile.type}`}>
                      <TileIcon name={displayedTile.icon} size={13} />
                      <span>{getTypeLabel(displayedTile.type)}</span>
                    </span>
                  </div>

                  {displayedTile.value !== undefined && (
                    <span
                      className={`landing-value-badge ${
                        displayedTile.type === 'income' || displayedTile.type === 'start'
                          ? 'badge-pos'
                          : 'badge-neg'
                      }`}
                    >
                      {displayedTile.type === 'income' || displayedTile.type === 'start' ? '+' : '-'}
                      {displayedTile.value.toLocaleString('hu-HU')} KK
                    </span>
                  )}
                </div>

                <div className="landing-tile-title">{displayedTile.name}</div>
                <div className="landing-tile-desc">{displayedTile.description}</div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};