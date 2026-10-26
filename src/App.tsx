import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Building2,
  Landmark,
  Wrench,
  RotateCcw,
  Volume2,
  VolumeX,
  Play,
  ArrowRight,
} from 'lucide-react';
import { BOARD_TILES } from './data/tiles.ts';
import { AVATARS } from './data/avatars.ts';
import { useGameEngine } from './hooks/useGameEngine.ts';
import { useGameAudio } from './hooks/useGameAudio.ts';
import type { PlayerId, GamePhase } from './types/game.ts';

// UI Components
import { GameBoard } from './components/Board/GameBoard.tsx';
import { PlayerHUD } from './components/HUD/PlayerHUD.tsx';
import { ClinicDashboard } from './components/Clinic/ClinicDashboard.tsx';
import { CardModal } from './components/Modals/CardModal.tsx';
import { BankModal } from './components/Modals/BankModal.tsx';
import { GameOverModal } from './components/Modals/GameOverModal.tsx';
import { DevPanel } from './components/DevTools/DevPanel.tsx';
import './App.css';

const PHASE_LABELS: Record<GamePhase, string> = {
  setup: 'Játék előkészítése',
  roll: 'Kockadobásra vár',
  moving: 'Bábumozgás...',
  tile_action: 'Mező eseménye',
  card_modal: 'Eseménykártya',
  bank_modal: 'Bank és Hitel',
  building: 'Építkezés és Fejlesztés',
  turn_end: 'Kör lezárása',
  game_over: 'Játék vége – Győzelem!',
};

export function App() {
  const engine = useGameEngine();
  const { gameState, activePlayer } = engine;
  const audio = useGameAudio(gameState);

  // Modal and panel visibility states
  const [isClinicOpen, setIsClinicOpen] = useState(false);
  const [isBankOpen, setIsBankOpen] = useState(false);
  const [isDevPanelOpen, setIsDevPanelOpen] = useState(false);

  // Setup state
  const [playerCount, setPlayerCount] = useState<number>(4);
  const [playerNames, setPlayerNames] = useState<string[]>([
    '1. Orvos',
    '2. Orvos',
    '3. Orvos',
    '4. Orvos',
  ]);

  // Current tile of active player
  const currentTile = useMemo(() => {
    if (!activePlayer) return undefined;
    return BOARD_TILES[activePlayer.position];
  }, [activePlayer]);

  // Handle game start with selected doctor avatars
  const handleStartGame = () => {
    const selectedAvatars = AVATARS.slice(0, playerCount);
    const configs = selectedAvatars.map((avatar, idx) => ({
      id: `p${idx + 1}` as PlayerId,
      name: playerNames[idx]?.trim() || `${idx + 1}. Játékos (${avatar.title})`,
      avatar: avatar.id,
      color: avatar.color,
    }));
    engine.startGame(configs);
  };

  // Handle dice roll
  const handleRollDice = useCallback(() => {
    if (gameState.phase !== 'roll' || gameState.isRolling) return;
    engine.rollDice();
  }, [gameState.phase, gameState.isRolling, engine]);

  // Keyboard shortcut: Space to roll dice
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Space' && gameState.phase === 'roll' && !gameState.isRolling) {
        e.preventDefault();
        handleRollDice();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [gameState.phase, gameState.isRolling, handleRollDice]);

  // Status message for the center board feed
  const statusMessage = useMemo(() => {
    if (gameState.phase === 'roll') {
      return `${activePlayer?.name ?? 'Játékos'}: Dobj a kockával a lépéshez! (Space vagy kattintás)`;
    }
    if (gameState.phase === 'moving') {
      return 'Bábu haladása a táblán...';
    }
    if (gameState.phase === 'tile_action' && currentTile) {
      return `Érkezés: ${currentTile.name} – Kattints a mező eseményének jóváhagyásához!`;
    }
    if (gameState.phase === 'building') {
      return 'Építkezési lehetőség! Vásárolj új részleget a klinikádhoz vagy fejezd be a köröd!';
    }
    if (gameState.phase === 'card_modal') {
      return 'Eseménykártya felhúzva! Olvasd el a lapot a folytatáshoz.';
    }
    return undefined;
  }, [gameState.phase, activePlayer?.name, currentTile]);

  return (
    <div className="app-container">
      {/* ======================================================== */}
      {/* 1. TOP HEADER & APP NAVIGATION */}
      {/* ======================================================== */}
      <header className="app-header">
        <div className="header-left">
          <div className="brand-logo">
            <span className="brand-icon">✚</span>
            <div className="brand-text">
              <span className="brand-title">CodeBlue</span>
              <span className="brand-sub">Magánklinika</span>
            </div>
          </div>

          {gameState.phase !== 'setup' && (
            <div className="header-phase-badge">
              <span className="phase-indicator-dot" />
              <span className="phase-text">{PHASE_LABELS[gameState.phase]}</span>
            </div>
          )}
        </div>

        {/* Global Toolbar Buttons */}
        {gameState.phase !== 'setup' && (
          <div className="header-actions">
            <button
              type="button"
              className={`header-btn ${isClinicOpen ? 'btn-active' : ''}`}
              onClick={() => setIsClinicOpen((prev) => !prev)}
              title="Klinika Tervrajz megtekintése"
            >
              <Building2 size={16} />
              <span>Klinika</span>
            </button>

            <button
              type="button"
              className={`header-btn ${isBankOpen ? 'btn-active' : ''}`}
              onClick={() => setIsBankOpen((prev) => !prev)}
              title="Klinikai Bank és Hitelkezelő"
            >
              <Landmark size={16} />
              <span>Bank</span>
            </button>

            <button
              type="button"
              className="header-btn"
              onClick={() => audio.setSoundEnabled(!audio.soundEnabled)}
              title={audio.soundEnabled ? 'Hangok némítása' : 'Hangok bekapcsolása'}
            >
              {audio.soundEnabled ? <Volume2 size={16} /> : <VolumeX size={16} />}
            </button>

            <button
              type="button"
              className={`header-btn btn-dev ${isDevPanelOpen ? 'btn-active' : ''}`}
              onClick={() => setIsDevPanelOpen((prev) => !prev)}
              title="Zsűri bemutató és tesztpanel"
            >
              <Wrench size={16} />
              <span>Zsűri Mód</span>
            </button>

            <button
              type="button"
              className="header-btn btn-reset"
              onClick={engine.resetGame}
              title="Játék újraindítása"
            >
              <RotateCcw size={16} />
            </button>
          </div>
        )}
      </header>

      {/* ======================================================== */}
      {/* 2. SETUP SCREEN (When phase === 'setup') */}
      {/* ======================================================== */}
      {gameState.phase === 'setup' ? (
        <main className="setup-container">
          <div className="setup-card">
            <div className="setup-hero">
              <img
                src="/assets/board_center.jpg"
                alt="Magánklinika"
                className="setup-hero-img"
              />
              <div className="setup-hero-overlay">
                <span className="setup-tag">HACKATHON 2026 EDITION</span>
                <h1 className="setup-title">Magánklinika Társasjáték</h1>
                <p className="setup-desc">
                  Építsd fel a legmodernebb magánklinikát, gazdálkodj okosan a bevételeiddel,
                  kerüld el a csődöt és érd el elsőként a teljes felkészültséget!
                </p>
              </div>
            </div>

            <div className="setup-form">
              <div className="setup-section">
                <label className="setup-label">Játékosok száma (2–4 fő):</label>
                <div className="player-count-buttons">
                  {[2, 3, 4].map((count) => (
                    <button
                      key={count}
                      type="button"
                      className={`count-toggle-btn ${playerCount === count ? 'active' : ''}`}
                      onClick={() => setPlayerCount(count)}
                    >
                      {count} Orvos
                    </button>
                  ))}
                </div>
              </div>

              <div className="setup-players-grid">
                {AVATARS.slice(0, playerCount).map((avatar, idx) => (
                  <div
                    key={avatar.id}
                    className="setup-player-card"
                    style={{ borderColor: avatar.color }}
                  >
                    <img
                      src={avatar.image || '/assets/board_center.jpg'}
                      alt={avatar.title}
                      className="setup-player-avatar"
                      style={{ borderColor: avatar.color }}
                    />
                    <div className="setup-player-info">
                      <span className="setup-player-role" style={{ color: avatar.color }}>
                        {avatar.title} • {avatar.role}
                      </span>
                      <input
                        type="text"
                        className="setup-player-name-input"
                        value={playerNames[idx]}
                        onChange={(e) => {
                          const newNames = [...playerNames];
                          newNames[idx] = e.target.value;
                          setPlayerNames(newNames);
                        }}
                        placeholder={`Pl. Dr. ${avatar.title}`}
                      />
                      <span className="setup-player-desc">{avatar.description}</span>
                    </div>
                  </div>
                ))}
              </div>

              <button
                type="button"
                className="btn-start-game"
                onClick={handleStartGame}
              >
                <Play size={20} />
                <span>Játék Indítása</span>
              </button>
            </div>
          </div>
        </main>
      ) : (
        /* ======================================================== */
        /* 3. ACTIVE GAME VIEW */
        /* ======================================================== */
        <>
          {/* Top Player HUD */}
          <PlayerHUD
            players={gameState.players}
            activePlayerIndex={gameState.activePlayerIndex}
            turnNumber={gameState.turnNumber}
          />

          <main className="app-main">
            {/* Center Area Action Overlay when tile_action or building */}
            <div className="game-stage-wrapper">
              <GameBoard
                tiles={BOARD_TILES}
                players={gameState.players}
                activePlayerIndex={gameState.activePlayerIndex}
                diceResult={gameState.diceResult}
                isRolling={gameState.isRolling}
                isMoving={gameState.phase === 'moving'}
                onRollDice={handleRollDice}
                onTileClick={(tile) => {
                  if (activePlayer) {
                    engine.devTeleport(activePlayer.id, tile.id);
                  }
                }}
                statusMessage={statusMessage}
              />

              {/* Action Bar Beneath the Board */}
              <div className="board-turn-controls">
                {gameState.phase === 'tile_action' && (
                  <button
                    type="button"
                    className="action-btn-primary animate-pulse"
                    onClick={engine.resolveTileAction}
                  >
                    <span>Mező eseményének végrehajtása</span>
                    <ArrowRight size={18} />
                  </button>
                )}

                {gameState.phase === 'building' && (
                  <div className="building-phase-controls">
                    <button
                      type="button"
                      className="action-btn-secondary"
                      onClick={() => setIsClinicOpen(true)}
                    >
                      <Building2 size={18} />
                      <span>Klinika Bővítése</span>
                    </button>

                    <button
                      type="button"
                      className="action-btn-primary"
                      onClick={engine.endTurn}
                    >
                      <span>Kör Befejezése</span>
                      <ArrowRight size={18} />
                    </button>
                  </div>
                )}

                {gameState.phase === 'roll' && (
                  <div className="roll-hint-badge">
                    <span>🎲 Nyomj <strong>Space</strong> billentyűt vagy kattints a fenti kockára a dobáshoz!</span>
                  </div>
                )}
              </div>
            </div>
          </main>
        </>
      )}

      {/* ======================================================== */}
      {/* 4. MODALS & POPUPS */}
      {/* ======================================================== */}

      {/* 4.1 Event Card Modal */}
      <CardModal
        card={gameState.drawnCard}
        isOpen={gameState.phase === 'card_modal'}
        onConfirm={engine.resolveCardAction}
      />

      {/* 4.2 Bank / Debt Modal */}
      <BankModal
        isOpen={isBankOpen || gameState.phase === 'bank_modal'}
        onClose={() => setIsBankOpen(false)}
        player={activePlayer}
        onTakeLoan={engine.takeLoan}
        onRepayLoan={engine.repayLoan}
      />

      {/* 4.3 Clinic Dashboard / Blueprint View */}
      {isClinicOpen && activePlayer && (
        <div className="clinic-modal-backdrop" onClick={() => setIsClinicOpen(false)}>
          <div className="clinic-modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="clinic-modal-header">
              <div className="clinic-header-info">
                <h2>{activePlayer.name} Klinikája</h2>
                <span style={{ color: activePlayer.color }}>{activePlayer.avatarTitle}</span>
              </div>
              <button
                type="button"
                className="clinic-modal-close"
                onClick={() => setIsClinicOpen(false)}
              >
                ✕
              </button>
            </div>
            <ClinicDashboard
              player={activePlayer}
              onBuyElement={engine.buyClinicElement}
              canBuyCheck={engine.canBuyElement}
              hasBuiltThisTurn={engine.hasBuiltThisTurn}
              isCurrentTurnActive={gameState.phase === 'building'}
            />
          </div>
        </div>
      )}

      {/* 4.4 Game Over / Victory Celebration */}
      <GameOverModal
        isOpen={gameState.phase === 'game_over' || gameState.winner !== null}
        winner={gameState.winner}
        turnNumber={gameState.turnNumber}
        onNewGame={engine.resetGame}
      />

      {/* 4.5 Jury DevTools Panel */}
      {isDevPanelOpen && (
        <DevPanel
          gameState={gameState}
          onAdjustCash={engine.devAdjustCash}
          onTeleport={engine.devTeleport}
          onDrawCard={engine.devDrawCard}
          onInstantVictory={engine.devInstantVictory}
          soundEnabled={audio.soundEnabled}
          onSoundEnabledChange={audio.setSoundEnabled}
          onPreviewSound={audio.previewSound}
        />
      )}

      {/* Footer */}
      <footer className="app-footer">
        <div className="footer-meta">
          <span>Soproni Egyetem Hackathon 2026</span> • <span>CodeBlue Csapat</span>
        </div>
        <div className="footer-tip">
          Körre osztott társasjáték • 40 eseménykártya • 8 klinikai részleg • 36 mező
        </div>
      </footer>
    </div>
  );
}

export default App;
