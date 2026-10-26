import React from 'react';
import type { Player } from '../../types/game.ts';
import { GAME_CONSTANTS } from '../../types/game.ts';
import { Landmark, Activity } from 'lucide-react';
import './PlayerHUD.css';

interface PlayerHUDProps {
  players: Player[];
  activePlayerIndex: number;
  turnNumber: number;
  onOpenBank?: () => void;
  selectedPlayerIndex?: number;
  onSelectPlayer?: (index: number) => void;
}

export const PlayerHUD: React.FC<PlayerHUDProps> = ({
  players,
  activePlayerIndex,
  turnNumber,
  onOpenBank,
  selectedPlayerIndex,
  onSelectPlayer,
}) => {
  if (players.length === 0) {
    return null;
  }

  const activePlayer = players[activePlayerIndex];

  return (
    <div className="player-hud-container">
      <div className="hud-top-bar">
        <div className="hud-turn-info">
          <span className="hud-turn-badge">Kör: #{turnNumber}</span>
          <span className="hud-active-callout">
            Soron lévő orvos: <strong>{activePlayer ? activePlayer.name : '-'}</strong>
          </span>
        </div>

        {onOpenBank && (
          <button type="button" className="btn-open-bank" onClick={onOpenBank}>
            <Landmark className="w-4 h-4" />
            <span>Klinikai Bank & Hitel</span>
          </button>
        )}
      </div>

      <div className="players-cards-grid">
        {players.map((player, index) => {
          const isActive = index === activePlayerIndex;
          const isSelected = selectedPlayerIndex === index;
          const builtCount = player.builtElements.length;
          const totalBuildings = GAME_CONSTANTS.TOTAL_CLINIC_ELEMENTS;

          return (
            <div
              key={player.id}
              className={`player-card ${isActive ? 'active' : ''} ${isSelected ? 'selected' : ''}`}
              onClick={() => onSelectPlayer?.(index)}
              style={{ cursor: onSelectPlayer ? 'pointer' : 'default' }}
            >
              {isActive && <span className="player-active-tag">Soron van</span>}

              <div className="player-header">
                <div
                  className="player-avatar-circle"
                  style={{ backgroundColor: player.color }}
                >
                  {player.name.charAt(0).toUpperCase()}
                </div>

                <div className="player-identity">
                  <h4 className="player-name">{player.name}</h4>
                  <p className="player-role">{player.avatarTitle}</p>
                </div>
              </div>

              {/* Statisztika: Tőke, Tartozás, Épületek */}
              <div className="player-stats-row">
                <div className="stat-item">
                  <span className="stat-label">Tőke</span>
                  <span className="stat-value cash" title={`${player.cash.toLocaleString()} KK`}>
                    {(player.cash / 1000).toFixed(0)}k KK
                  </span>
                </div>

                <div className="stat-item">
                  <span className="stat-label">Hitel</span>
                  <span
                    className={`stat-value ${player.debt > 0 ? 'debt' : 'text-slate-400'}`}
                    title={`${player.debt.toLocaleString()} KK`}
                  >
                    {player.debt > 0 ? `${(player.debt / 1000).toFixed(0)}k` : '0'} KK
                  </span>
                </div>

                <div className="stat-item">
                  <span className="stat-label">Részlegek</span>
                  <span className="stat-value built">
                    {builtCount} / {totalBuildings}
                  </span>
                </div>
              </div>

              {/* Jelvények: Kimaradás és Buffok */}
              {(player.skipTurns > 0 || player.activeBuffs.length > 0) && (
                <div className="player-buffs-chips">
                  {player.skipTurns > 0 && (
                    <span className="hud-chip skip">
                      {player.skipTurns} körből kimarad
                    </span>
                  )}
                  {player.activeBuffs.map((buff) => (
                    <span key={buff.id} className="hud-chip buff" title={buff.description}>
                      <Activity className="w-3 h-3 inline mr-0.5" />
                      {buff.name}
                    </span>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};
export default PlayerHUD;
