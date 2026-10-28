import React from 'react';
import type { Player } from '../../types/game.ts';
import { CLINIC_ELEMENTS } from '../../data/clinicElements.ts';
import { Trophy, CheckCircle2, RotateCcw, LogOut } from 'lucide-react';
import './GameOverModal.css';

interface GameOverModalProps {
  isOpen: boolean;
  winner: Player | null;
  turnNumber: number;
  onNewGame: () => void;
  gameMode?: 'local' | 'online' | null;
  players?: Player[];
  myPlayerId?: string;
  rematchVotes?: Record<string, boolean>;
  onVoteRematch?: (ready: boolean) => void;
  onLeaveRoom?: () => void;
}

export const GameOverModal: React.FC<GameOverModalProps> = ({
  isOpen,
  winner,
  turnNumber,
  onNewGame,
  gameMode = 'local',
  players = [],
  myPlayerId,
  rematchVotes = {},
  onVoteRematch,
  onLeaveRoom,
}) => {
  if (!isOpen || !winner) {
    return null;
  }

  const isOnline = gameMode === 'online';
  const isMyVoteReady = myPlayerId ? rematchVotes[myPlayerId] === true : false;

  return (
    <div className="game-over-backdrop">
      <div className="game-over-card">
        <div className="victory-halo" />

        <div className="trophy-container">
          <Trophy size={36} className="trophy-icon" />
        </div>

        <div className="victory-header">
          <h2 className="victory-title">A Magánklinika Megépült!</h2>
          <p className="victory-subtitle">
            Megszületett a város legkorszerűbb magánklinikájának nyertes igazgatója!
          </p>
        </div>

        <div className="victory-winner-banner" style={{ borderColor: winner.color }}>
          <div
            className="winner-avatar-disc"
            style={{ backgroundColor: winner.color }}
          >
            {winner.name.charAt(0).toUpperCase()}
          </div>
          <div className="winner-meta">
            <span className="winner-name-text">{winner.name}</span>
            <span className="winner-role-text">{winner.avatarTitle}</span>
          </div>
        </div>

        {/* 8 felépült részleg felsorolása */}
        <div className="victory-clinic-showcase">
          <div className="showcase-header">
            <CheckCircle2 size={16} className="showcase-icon" />
            <span>Mind a 8 klinikai részleg sikeresen átadva!</span>
          </div>
          <div className="elements-completed-grid">
            {CLINIC_ELEMENTS.map((el) => (
              <div
                key={el.id}
                className="element-completed-chip"
                title={`${el.name} (${el.cost.toLocaleString('hu-HU')} KK)`}
              >
                <CheckCircle2 size={14} className="element-check-icon" />
                <span className="element-chip-label">{el.name}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Statisztikák */}
        <div className="victory-stats-row">
          <div className="stat-box">
            <span className="stat-box-label">Záró egyenleg</span>
            <span className="stat-box-val cash-val">
              {winner.cash.toLocaleString('hu-HU')} KK
            </span>
          </div>

          <div className="stat-box">
            <span className="stat-box-label">Tartozás</span>
            <span className="stat-box-val debt-val">0 KK</span>
          </div>

          <div className="stat-box">
            <span className="stat-box-label">Körök száma</span>
            <span className="stat-box-val">{turnNumber} kör</span>
          </div>
        </div>

        {/* Online Visszavágó Rendszer */}
        {isOnline ? (
          <div className="rematch-panel">
            <h3 className="rematch-title">Visszavágó és Új Meccs</h3>
            <p className="rematch-subtitle">
              Amint minden játékos kész, a szoba azonnal újraindul az 1. körtől!
            </p>

            <div className="rematch-players-list">
              {players.map((p) => {
                const isReady = rematchVotes[p.id] === true;
                const isMe = p.id === myPlayerId;
                return (
                  <div key={p.id} className={`rematch-player-item ${isReady ? 'ready' : ''}`}>
                    <span className="rematch-player-dot" style={{ backgroundColor: p.color }} />
                    <span className="rematch-player-name">
                      {p.name} {isMe ? '(Te)' : ''}
                    </span>
                    <span
                      className={`rematch-player-badge ${isReady ? 'badge-ready' : 'badge-waiting'}`}
                    >
                      {isReady ? 'Kész ✓' : 'Várakozás...'}
                    </span>
                  </div>
                );
              })}
            </div>

            <div className="rematch-actions-row">
              <button
                type="button"
                className={`btn-vote-rematch ${isMyVoteReady ? 'active' : ''}`}
                onClick={() => onVoteRematch?.(!isMyVoteReady)}
              >
                <RotateCcw size={18} />
                <span>{isMyVoteReady ? 'Készen állsz! (Visszavonás)' : 'Visszavágót kérek'}</span>
              </button>

              {onLeaveRoom && (
                <button type="button" className="btn-leave-rematch" onClick={onLeaveRoom}>
                  <LogOut size={16} />
                  <span>Kilépés a Menübe</span>
                </button>
              )}
            </div>
          </div>
        ) : (
          <button type="button" className="btn-new-game" onClick={onNewGame}>
            <RotateCcw size={18} />
            <span>Új játék indítása</span>
          </button>
        )}
      </div>
    </div>
  );
};

export default GameOverModal;
