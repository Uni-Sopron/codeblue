import React from 'react';
import { RotateCcw, LogOut, Volume2, VolumeX, Wrench, X, ShieldAlert, Play, Lock } from 'lucide-react';
import './GameMenuModal.css';

interface GameMenuModalProps {
  isOpen: boolean;
  onClose: () => void;
  gameMode: 'local' | 'online' | null;
  isHost: boolean;
  soundEnabled: boolean;
  onToggleSound: () => void;
  isDevUnlocked: boolean;
  onOpenDevAuth: () => void;
  onOpenDevPanel: () => void;
  onLockDev?: () => void;
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
  isDevUnlocked,
  onOpenDevAuth,
  onOpenDevPanel,
  onLockDev,
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
              {isOnline ? 'Multiplayer Mérkőzés' : 'Helyi Játékmenet'}
            </p>
          </div>
          <button
            type="button"
            className="game-menu-close"
            onClick={onClose}
            aria-label="Menü bezárása"
          >
            <X size={20} />
          </button>
        </div>

        {/* Menu Actions List */}
        <div className="game-menu-body">
          {/* 1. Host Restart (Only for Host or Local) */}
          {(isHost || !isOnline) && (
            <button
              type="button"
              className="game-menu-item item-restart"
              onClick={() => {
                onRestartMatch();
                onClose();
              }}
            >
              <div className="menu-item-icon icon-restart">
                {isOnline ? <Play size={20} /> : <RotateCcw size={20} />}
              </div>
              <div className="menu-item-content">
                <span className="menu-item-title">
                  {isOnline ? 'Új meccs kezdeményezése' : 'Mérkőzés Újraindítása'}
                </span>
                <span className="menu-item-desc">
                  {isOnline
                    ? 'Új meccs szavazás indítása az aktuális szobában'
                    : 'A tábla és a pénztárcák alaphelyzetbe állítása'}
                </span>
              </div>
            </button>
          )}

          {/* 2. Client Rematch Prompt (If in online game as guest) */}
          {!isHost && isOnline && (
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
                <span className="menu-item-title">Visszavágó Kérése</span>
                <span className="menu-item-desc">
                  Szavazz az új meccs elindítására a szobagazdánál
                </span>
              </div>
            </button>
          )}

          {/* 3. Audio / Sound Toggle */}
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
          {isDevUnlocked ? (
            <>
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
                  <span className="menu-item-title">Fejlesztői Tesztpanel</span>
                  <span className="menu-item-desc">Teleportálás, kártyahúzás és egyenleg állítás</span>
                </div>
              </button>
              {onLockDev && (
                <button
                  type="button"
                  className="game-menu-item"
                  onClick={() => {
                    onLockDev();
                    onClose();
                  }}
                >
                  <div className="menu-item-icon icon-neutral">
                    <Lock size={20} />
                  </div>
                  <div className="menu-item-content">
                    <span className="menu-item-title">Fejlesztői Mód Zárolása</span>
                    <span className="menu-item-desc">Jelszavas védelem visszaállítása és gomb elrejtése</span>
                  </div>
                </button>
              )}
            </>
          ) : (
            <button
              type="button"
              className="game-menu-item"
              onClick={() => {
                onClose();
                onOpenDevAuth();
              }}
            >
              <div className="menu-item-icon icon-neutral">
                <Lock size={20} />
              </div>
              <div className="menu-item-content">
                <span className="menu-item-title">Fejlesztői Mód feloldása</span>
                <span className="menu-item-desc">Jelszóval védett tesztpanel és szimuláció</span>
              </div>
            </button>
          )}

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
                  ? 'Kilépés a többjátékos szobából és a játék elhagyása'
                  : 'Aktuális játszma befejezése'}
              </span>
            </div>
          </button>
        </div>

        {/* Footer Warning for Online games */}
        {isOnline && (
          <div className="game-menu-footer">
            <ShieldAlert size={14} className="footer-warn-icon" />
            <span>A kilépéssel az orvosod státusza inaktívvá válik a szobában.</span>
          </div>
        )}
      </div>
    </div>
  );
};
