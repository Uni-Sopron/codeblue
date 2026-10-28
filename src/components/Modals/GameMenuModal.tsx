import React from 'react';
import { RotateCcw, LogOut, Volume2, VolumeX, Wrench, X, ShieldAlert, Play } from 'lucide-react';
import './GameMenuModal.css';

interface GameMenuModalProps {
  isOpen: boolean;
  onClose: () => void;
  gameMode: 'local' | 'online' | null;
  isHost: boolean;
  soundEnabled: boolean;
  onToggleSound: () => void;
  onOpenDevPanel: () => void;
  onRestartMatch: () => void;
  onExitToMainMenu: () => void;
}

export const GameMenuModal: React.FC<GameMenuModalProps> = ({
  isOpen,
  onClose,
  gameMode,
  isHost,
  soundEnabled,
  onToggleSound,
  onOpenDevPanel,
  onRestartMatch,
  onExitToMainMenu,
}) => {
  if (!isOpen) return null;

  const isOnline = gameMode === 'online';

  return (
    <div className="game-menu-backdrop" onClick={onClose}>
      <div className="game-menu-card" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="game-menu-header">
          <div className="game-menu-brand">
            <span className="game-menu-badge">✚ Menü</span>
            <h2 className="game-menu-title">CodeBlue Magánklinika</h2>
            <p className="game-menu-subtitle">
              {isOnline ? (isHost ? 'Online Szoba (Szobagazda)' : 'Online Szoba (Vendég)') : 'Helyi Játékmenet'}
            </p>
          </div>
          <button type="button" className="game-menu-close-btn" onClick={onClose} aria-label="Bezárás">
            <X size={20} />
          </button>
        </div>

        {/* Menu Actions List */}
        <div className="game-menu-items">
          {/* 1. Resume */}
          <button
            type="button"
            className="game-menu-item item-resume"
            onClick={onClose}
          >
            <div className="menu-item-icon icon-resume">
              <Play size={20} />
            </div>
            <div className="menu-item-content">
              <span className="menu-item-title">Vissza a Játékhoz</span>
              <span className="menu-item-desc">Játék folytatása a jelenlegi körben</span>
            </div>
          </button>

          {/* 2. Restart Match (In-Place) */}
          <button
            type="button"
            className="game-menu-item item-restart"
            onClick={() => {
              onRestartMatch();
              onClose();
            }}
          >
            <div className="menu-item-icon icon-restart">
              <RotateCcw size={20} />
            </div>
            <div className="menu-item-content">
              <span className="menu-item-title">
                {isOnline
                  ? isHost
                    ? 'Új Meccs Kezdeményezése (Közös Újraindítás)'
                    : 'Új Meccs Kérése'
                  : 'Játék Újraindítása (Azonnali új meccs)'}
              </span>
              <span className="menu-item-desc">
                {isOnline
                  ? 'A jelenlegi szobában új 1. kör indul az orvosokkal (nem lép ki a menübe)'
                  : 'A táblán új meccs indul 1 500 000 KK tőkével, a kiválasztott orvosokkal'}
              </span>
            </div>
          </button>

          {/* 3. Audio Toggle */}
          <button
            type="button"
            className="game-menu-item"
            onClick={onToggleSound}
          >
            <div className="menu-item-icon icon-neutral">
              {soundEnabled ? <Volume2 size={20} /> : <VolumeX size={20} />}
            </div>
            <div className="menu-item-content">
              <span className="menu-item-title">Hanghatások</span>
              <span className="menu-item-desc">
                Jelenleg: <strong>{soundEnabled ? 'Bekapcsolva' : 'Némítva'}</strong>
              </span>
            </div>
          </button>

          {/* 4. Jury / Dev Panel */}
          <button
            type="button"
            className="game-menu-item"
            onClick={() => {
              onOpenDevPanel();
              onClose();
            }}
          >
            <div className="menu-item-icon icon-dev">
              <Wrench size={20} />
            </div>
            <div className="menu-item-content">
              <span className="menu-item-title">Zsűri Tesztpanel</span>
              <span className="menu-item-desc">Teleportálás, kártyahúzás és egyenleg állítás</span>
            </div>
          </button>

          {/* 5. Exit to Main Menu */}
          <button
            type="button"
            className="game-menu-item item-exit"
            onClick={() => {
              onExitToMainMenu();
              onClose();
            }}
          >
            <div className="menu-item-icon icon-danger">
              <LogOut size={20} />
            </div>
            <div className="menu-item-content">
              <span className="menu-item-title">Kilépés a Főmenübe</span>
              <span className="menu-item-desc">
                {isOnline
                  ? 'Szoba elhagyása és visszatérés a többjátékos lobbyba'
                  : 'Játék befejezése és visszalépés a beállításokhoz'}
              </span>
            </div>
          </button>
        </div>

        {/* Footer */}
        <div className="game-menu-footer">
          <div className="game-menu-tip">
            <ShieldAlert size={14} className="shrink-0 text-sky-400" />
            <span>Az újraindítás helyben történik, a főmenübe való kilépéshez válaszd a Kilépést.</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default GameMenuModal;
