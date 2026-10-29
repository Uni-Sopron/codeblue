import React from 'react';
import type { Player } from '../../types/game.ts';
import { GAME_CONSTANTS } from '../../types/game.ts';
import { getAvatarById } from '../../data/avatars.ts';
import { Landmark, Activity } from 'lucide-react';
import './PlayerHUD.css';

interface PlayerHUDProps {
  players: Player[];
  activePlayerIndex: number;
  turnNumber: number;
  onOpenBank?: () => void;
  selectedPlayerIndex?: number;
  onSelectPlayer?: (index: number) => void;
  myPlayerId?: string;
  offlineTimers?: Record<string, number>;
}

export const PlayerHUD: React.FC<PlayerHUDProps> = ({
  players,
  activePlayerIndex,
  turnNumber,
  onOpenBank,
  selectedPlayerIndex,
  onSelectPlayer,
  myPlayerId,
  offlineTimers,
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
            {activePlayer?.isAI && <span className="player-bot-tag">[BOT]</span>}
          </span>
        </div>

        {onOpenBank && (
          <button type="button" className="btn-open-bank" onClick={onOpenBank}>
            <Landmark className="w-4 h-4" />
            <span>Klinikai Bank & Hitel</span>
          </button>
        )}
      </div>

      <div className="players-cards-grid" style={{ '--player-count': players.length } as React.CSSProperties}>
        {players.map((player, index) => {
          const isActive = index === activePlayerIndex;
          const isSelected = selectedPlayerIndex === index;
          const isMe = myPlayerId === player.id;
          const avatarInfo = getAvatarById(player.avatar);
          const builtCount = player.builtElements.length;
          const totalBuildings = GAME_CONSTANTS.TOTAL_CLINIC_ELEMENTS;
          const isEliminated = player.eliminated === true;
          const isOffline = player.connected === false && !isEliminated;
          const remainingSeconds = offlineTimers?.[player.id];
          const isTimedOutPlayer = isOffline && typeof remainingSeconds === 'number' && remainingSeconds > 0;

          return (
            <div
              key={player.id}
              className={`player-card ${isActive && !isEliminated ? 'active' : ''} ${isSelected ? 'selected' : ''} ${isOffline ? 'disconnected' : ''} ${isEliminated ? 'eliminated' : ''}`}
              onClick={() => onSelectPlayer?.(index)}
              style={{ cursor: onSelectPlayer ? 'pointer' : 'default' }}
            >
              {isActive && !isEliminated && <span className="player-active-tag">Soron van</span>}
              {isEliminated && <span className="player-eliminated-tag">Kiszállt</span>}
              {isOffline && (
                <span className={`player-offline-tag ${isTimedOutPlayer ? 'pulse' : ''}`}>
                  {isTimedOutPlayer ? `Offline (${remainingSeconds}s)` : 'Offline'}
                </span>
              )}

              <div className="player-header">
                <div
                  className="player-avatar-circle"
                  style={{
                    borderColor: player.color,
                    boxShadow: isActive ? `0 0 10px ${player.color}` : undefined,
                  }}
                >
                  {avatarInfo?.image ? (
                    <img
                      src={avatarInfo.image}
                      alt={player.name}
                      className="player-avatar-hud-img"
                    />
                  ) : (
                    <span style={{ color: player.color }}>
                      {player.name.charAt(0).toUpperCase()}
                    </span>
                  )}
                </div>

                <div className="player-identity">
                  <div className="player-name-row">
                    <h4 className="player-name">{player.name}</h4>
                    {player.isAI && <span className="player-bot-tag">[BOT]</span>}
                    {isMe && <span className="player-me-tag">Te</span>}
                  </div>
                  <p className="player-role">{avatarInfo?.title || player.avatarTitle}</p>
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
