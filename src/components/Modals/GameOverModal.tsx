import React from 'react';
import type { Player } from '../../types/game.ts';
import { CLINIC_ELEMENTS } from '../../data/clinicElements.ts';
import { Trophy, CheckCircle2, RotateCcw } from 'lucide-react';
import './GameOverModal.css';

interface GameOverModalProps {
  isOpen: boolean;
  winner: Player | null;
  turnNumber: number;
  onNewGame: () => void;
}

export const GameOverModal: React.FC<GameOverModalProps> = ({
  isOpen,
  winner,
  turnNumber,
  onNewGame,
}) => {
  if (!isOpen || !winner) {
    return null;
  }

  return (
    <div className="game-over-backdrop">
      <div className="game-over-card">
        <div className="victory-halo" />

        <div className="trophy-container">
          <Trophy className="w-10 h-10 text-amber-400" />
        </div>

        <div>
          <h2 className="victory-title">A Magánklinika Megépült!</h2>
          <p className="text-sm text-slate-300 mt-1">
            Megszületett a város legkorszerűbb magánklinikájának nyertes igazgatója!
          </p>
        </div>

        <div className="victory-winner-banner">
          <div
            className="winner-avatar-disc"
            style={{ backgroundColor: winner.color }}
          >
            {winner.name.charAt(0).toUpperCase()}
          </div>
          <div className="text-left">
            <span className="winner-name-text">{winner.name}</span>
            <span className="block text-xs text-slate-400">{winner.avatarTitle}</span>
          </div>
        </div>

        {/* 8 felépült részleg felsorolása */}
        <div className="victory-clinic-showcase">
          <div className="showcase-header">
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            <span>Mind a 8 klinikai részleg sikeresen átadva!</span>
          </div>
          <div className="elements-completed-grid">
            {CLINIC_ELEMENTS.map((el) => (
              <div key={el.id} className="element-completed-chip" title={el.name}>
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span className="truncate w-full">{el.name.split(' ')[0]}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Statisztikák */}
        <div className="victory-stats-row">
          <div className="stat-box">
            <span className="stat-box-label">Záró egyenleg</span>
            <span className="stat-box-val text-emerald-400">
              {winner.cash.toLocaleString()} KK
            </span>
          </div>

          <div className="stat-box">
            <span className="stat-box-label">Tartozás</span>
            <span className="stat-box-val text-sky-400">0 KK</span>
          </div>

          <div className="stat-box">
            <span className="stat-box-label">Körök száma</span>
            <span className="stat-box-val">{turnNumber} kör</span>
          </div>
        </div>

        <button type="button" className="btn-new-game" onClick={onNewGame}>
          <RotateCcw className="w-5 h-5" />
          <span>Új játék indítása</span>
        </button>
      </div>
    </div>
  );
};
export default GameOverModal;
