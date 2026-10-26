import React from 'react';
import type { Tile as TileType, Player } from '../../types/game.ts';
import { getAvatarById } from '../../data/avatars.ts';
import { Tile } from './Tile.tsx';
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
}) => {
  const activePlayer = players[activePlayerIndex];
  const activeAvatar = activePlayer ? getAvatarById(activePlayer.avatar) : undefined;
  const currentTile = activePlayer ? tiles[activePlayer.position] : undefined;

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

  return (
    <div className="game-board-wrapper">
      <div className="game-board-grid">
        {/* Render 36 Perimeter Tiles */}
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
                onClick={() => onTileClick?.(tile)}
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
            {/* Minimalist Center Pill */}
            <div className="center-header-minimal">
              <span className="center-badge-minimal">🏥 MAGÁNKLINIKA • KÖRRE OSZTOTT TÁRSAS</span>
            </div>

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
                disabled={isMoving || isRolling}
                buttonLabel={isMoving ? 'Lépkedés...' : 'Kockadobás'}
              />
            </div>

            {/* Current Tile / Status Feed */}
            <div className="center-status-feed">
              {statusMessage ? (
                <div className="status-msg">{statusMessage}</div>
              ) : currentTile ? (
                <div className="status-tile-info">
                  <span className="status-tile-name">{currentTile.name}</span>
                  <span className="status-tile-desc">{currentTile.description}</span>
                </div>
              ) : null}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
