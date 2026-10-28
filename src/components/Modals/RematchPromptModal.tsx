import React from 'react';
import { RotateCcw, CheckCircle2, Clock, X, Check } from 'lucide-react';
import type { Player } from '../../types/game';
import './RematchPromptModal.css';

interface RematchPromptModalProps {
  isOpen: boolean;
  requestedBy?: string;
  isHostRequester?: boolean;
  players: Player[];
  rematchVotes: Record<string, boolean>;
  myPlayerId?: string;
  onAccept: () => void;
  onDecline: () => void;
}

export const RematchPromptModal: React.FC<RematchPromptModalProps> = ({
  isOpen,
  requestedBy,
  isHostRequester,
  players,
  rematchVotes,
  myPlayerId,
  onAccept,
  onDecline,
}) => {
  if (!isOpen) return null;

  const connectedPlayers = players.filter((p) => p.connected !== false);
  const myVote = myPlayerId ? !!rematchVotes[myPlayerId] : false;

  return (
    <div className="rematch-prompt-backdrop">
      <div className="rematch-prompt-card">
        {/* Header */}
        <div className="rematch-prompt-header">
          <div className="rematch-prompt-icon">
            <RotateCcw className="w-6 h-6 animate-spin-slow" />
          </div>
          <div className="rematch-prompt-titles">
            <h3 className="rematch-prompt-title">Új Meccs Kezdeményezve</h3>
            <p className="rematch-prompt-desc">
              <strong>{requestedBy || 'A szobagazda'}</strong>
              {isHostRequester ? ' (Szobagazda)' : ''} új játékot kezdeményezett a szobában!
            </p>
          </div>
        </div>

        {/* Player readiness checklist */}
        <div className="rematch-prompt-body">
          <span className="rematch-list-label">Szoba résztvevőinek állapota:</span>
          <div className="rematch-players-list">
            {connectedPlayers.map((player) => {
              const isReady = !!rematchVotes[player.id];
              const isMe = player.id === myPlayerId;

              return (
                <div
                  key={player.id}
                  className={`rematch-player-row ${isReady ? 'ready' : 'waiting'}`}
                >
                  <div className="rematch-player-left">
                    <span
                      className="rematch-player-dot"
                      style={{ backgroundColor: player.color || '#38bdf8' }}
                    />
                    <span className="rematch-player-name">
                      {player.name}
                      {player.isHost && <span className="rematch-host-badge">Gazda</span>}
                      {isMe && <span className="rematch-me-badge">(Te)</span>}
                    </span>
                  </div>

                  <div className="rematch-player-status">
                    {isReady ? (
                      <span className="status-badge-ready">
                        <CheckCircle2 size={14} />
                        <span>Kész</span>
                      </span>
                    ) : (
                      <span className="status-badge-waiting">
                        <Clock size={14} className="animate-pulse" />
                        <span>Döntésre vár</span>
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Action buttons */}
        <div className="rematch-prompt-footer">
          {myVote ? (
            <div className="rematch-waiting-container">
              <div className="rematch-waiting-notice">
                <Check size={18} className="text-emerald-400" />
                <span>Elfogadtad! Várakozás a többi játékos megerősítésére...</span>
              </div>
              <button
                type="button"
                className="rematch-btn-cancel-waiting"
                onClick={onDecline}
                title="Kérelem visszavonása és meccs folytatása"
              >
                <X size={14} />
                <span>Kérelem visszavonása</span>
              </button>
            </div>
          ) : (
            <>
              <button
                type="button"
                className="rematch-btn-decline"
                onClick={onDecline}
              >
                <X size={16} />
                <span>Nem, folytassuk</span>
              </button>
              <button
                type="button"
                className="rematch-btn-accept"
                onClick={onAccept}
              >
                <Check size={16} />
                <span>Új Meccs Elfogadása</span>
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default RematchPromptModal;
