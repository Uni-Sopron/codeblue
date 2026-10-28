import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  Building2,
  Landmark,
  Wrench,
  Volume2,
  VolumeX,
  Play,
  ArrowRight,
  ArrowLeft,
  Wifi,
  Menu,
} from 'lucide-react';
import { BOARD_TILES } from './data/tiles.ts';
import { AVATARS } from './data/avatars.ts';
import { useGameEngine } from './hooks/useGameEngine.ts';
import { useGameAudio } from './hooks/useGameAudio.ts';
import type { PlayerId, GamePhase, GameState, Player } from './types/game.ts';
import {
  multiplayerService,
  type RemotePlayer,
  type MultiplayerRoom,
} from './services/multiplayerSocket.ts';

// UI Components
import { MultiplayerLobby } from './components/Lobby/MultiplayerLobby.tsx';
import { GameBoard } from './components/Board/GameBoard.tsx';
import { PlayerHUD } from './components/HUD/PlayerHUD.tsx';
import { ClinicDashboard } from './components/Clinic/ClinicDashboard.tsx';
import { CardModal } from './components/Modals/CardModal.tsx';
import { BankModal } from './components/Modals/BankModal.tsx';
import { GameOverModal } from './components/Modals/GameOverModal.tsx';
import { ConfirmExitModal } from './components/Modals/ConfirmExitModal.tsx';
import { GameMenuModal } from './components/Modals/GameMenuModal.tsx';
import { RematchPromptModal } from './components/Modals/RematchPromptModal.tsx';
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
  const [isConfirmExitOpen, setIsConfirmExitOpen] = useState(false);
  const [isGameMenuOpen, setIsGameMenuOpen] = useState(false);
  const [isRematchPromptOpen, setIsRematchPromptOpen] = useState(false);
  const [rematchRequester, setRematchRequester] = useState<{ name: string; isHost: boolean } | null>(null);

  // Multiplayer and game mode state
  const [gameMode, setGameMode] = useState<'local' | 'online' | null>(null);
  const [onlineRoom, setOnlineRoom] = useState<MultiplayerRoom | null>(null);
  const [myRemotePlayer, setMyRemotePlayer] = useState<RemotePlayer | null>(null);
  const [rematchVotes, setRematchVotes] = useState<Record<string, boolean>>({});
  const [turnTimeoutRemaining, setTurnTimeoutRemaining] = useState<number | null>(null);
  const [toastMessage, setToastMessage] = useState<{ id: number; text: string; type: 'info' | 'warning' | 'success' } | null>(null);
  const isRemoteUpdateRef = useRef(false);

  // Setup state (for local hotseat)
  const [playerCount, setPlayerCount] = useState<number>(4);
  const [playerNames, setPlayerNames] = useState<string[]>([
    '1. Orvos',
    '2. Orvos',
    '3. Orvos',
    '4. Orvos',
  ]);

  // Determine if it is currently my turn
  const isMyTurn = useMemo(() => {
    if (gameMode !== 'online') return true;
    if (!myRemotePlayer || !activePlayer) return false;
    return activePlayer.id === myRemotePlayer.id;
  }, [gameMode, myRemotePlayer, activePlayer]);

  // Current tile of active player
  const currentTile = useMemo(() => {
    if (!activePlayer) return undefined;
    return BOARD_TILES[activePlayer.position];
  }, [activePlayer]);

  // Handle local game start
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

  // Handle online game start callback from lobby
  const handleStartOnlineGame = useCallback(
    (startedRoom: MultiplayerRoom, me: RemotePlayer) => {
      setGameMode('online');
      setOnlineRoom(startedRoom);
      setMyRemotePlayer(me);

      const configs = startedRoom.players.map((p, idx) => {
        const avatarInfo = AVATARS.find((a) => a.id === p.avatar) || AVATARS[idx % AVATARS.length];
        return {
          id: `p${idx + 1}` as PlayerId,
          name: p.name,
          avatar: avatarInfo.id,
          color: avatarInfo.color,
        };
      });
      engine.startGame(configs);
    },
    [engine]
  );

  // Socket listeners for game start and state synchronization
  useEffect(() => {
    const socket = multiplayerService.getSocket();

    const handleGameStarted = ({
      room: startedRoom,
      gameState: initialGameState,
    }: {
      room: MultiplayerRoom;
      gameState?: GameState;
    }) => {
      setGameMode('online');
      setOnlineRoom(startedRoom);
      const me = startedRoom.players.find((p) => p.socketId === socket.id);
      if (me) setMyRemotePlayer(me);
      if (initialGameState) {
        isRemoteUpdateRef.current = true;
        engine.setFullGameState(initialGameState);
      } else {
        const configs = startedRoom.players.map((p, idx) => {
          const avatarInfo = AVATARS.find((a) => a.id === p.avatar) || AVATARS[idx % AVATARS.length];
          return {
            id: `p${idx + 1}` as PlayerId,
            name: p.name,
            avatar: avatarInfo.id,
            color: avatarInfo.color,
          };
        });
        engine.startGame(configs);
      }
    };

    const handleRemoteSync = ({ gameState: remoteState }: { gameState: GameState }) => {
      if (remoteState) {
        isRemoteUpdateRef.current = true;
        engine.setFullGameState(remoteState);
      }
    };

    const handlePlayerDisconnected = ({
      playerId,
      playerName,
      timeoutSeconds,
    }: {
      playerId: string;
      playerName: string;
      timeoutSeconds?: number;
    }) => {
      isRemoteUpdateRef.current = true;
      engine.setFullGameState((prev: GameState) => ({
        ...prev,
        players: prev.players.map((p: Player) =>
          p.id === playerId ? { ...p, connected: false } : p
        ),
      }));

      if (timeoutSeconds) {
        setTurnTimeoutRemaining(timeoutSeconds);
      }

      setToastMessage({
        id: Date.now(),
        text: `⚠️ ${playerName} kapcsolata megszakadt.${timeoutSeconds ? ` Körátadás ${timeoutSeconds} mp múlva.` : ''}`,
        type: 'warning',
      });
    };

    const handlePlayerReconnected = ({
      playerId,
      playerName,
    }: {
      playerId: string;
      playerName: string;
    }) => {
      isRemoteUpdateRef.current = true;
      engine.setFullGameState((prev: GameState) => ({
        ...prev,
        players: prev.players.map((p: Player) =>
          p.id === playerId ? { ...p, connected: true } : p
        ),
      }));

      setTurnTimeoutRemaining(null);

      setToastMessage({
        id: Date.now(),
        text: `✅ ${playerName} visszacsatlakozott!`,
        type: 'success',
      });
    };

    const handleRematchUpdate = ({
      votes,
      requestedBy,
      isHost: requesterIsHost,
      ready,
    }: {
      votes: Record<string, boolean>;
      requestedBy?: string;
      isHost?: boolean;
      ready?: boolean;
    }) => {
      setRematchVotes(votes || {});
      if (requestedBy) {
        setRematchRequester({ name: requestedBy, isHost: !!requesterIsHost });
      }
      if (ready && requestedBy) {
        setIsRematchPromptOpen(true);
        setToastMessage({
          id: Date.now(),
          text: `🔔 ${requestedBy} új meccs indítását kezdeményezte!`,
          type: 'info',
        });
      }
    };

    const handleGameReset = ({
      room: resetRoom,
      gameState: resetGameState,
    }: {
      room: MultiplayerRoom;
      gameState: GameState;
    }) => {
      setRematchVotes({});
      setIsRematchPromptOpen(false);
      setIsGameMenuOpen(false);
      setIsConfirmExitOpen(false);
      setRematchRequester(null);
      setTurnTimeoutRemaining(null);
      setOnlineRoom(resetRoom);
      isRemoteUpdateRef.current = true;
      engine.setFullGameState(resetGameState);
      setToastMessage({
        id: Date.now(),
        text: '🚀 A visszavágó elindult! Új játék kezdődött.',
        type: 'success',
      });
    };

    const handleTurnAutoPassed = ({
      gameState: updatedState,
    }: {
      newActivePlayerIndex: number;
      gameState: GameState;
    }) => {
      setTurnTimeoutRemaining(null);
      if (updatedState) {
        isRemoteUpdateRef.current = true;
        engine.setFullGameState(updatedState);
      }
      setToastMessage({
        id: Date.now(),
        text: '⏱️ Az inaktív játékos köre átadásra került.',
        type: 'info',
      });
    };

    const handlePlayerLeft = ({ playerName }: { playerName: string }) => {
      setToastMessage({
        id: Date.now(),
        text: `ℹ️ ${playerName} elhagyta a szobát.`,
        type: 'info',
      });
    };

    socket.on('game:started', handleGameStarted);
    socket.on('game:sync_broadcast', handleRemoteSync);
    socket.on('player:disconnected', handlePlayerDisconnected);
    socket.on('player:reconnected', handlePlayerReconnected);
    socket.on('room:rematch_update', handleRematchUpdate);
    socket.on('room:game_reset', handleGameReset);
    socket.on('turn:auto_passed', handleTurnAutoPassed);
    socket.on('room:player_left', handlePlayerLeft);

    return () => {
      socket.off('game:started', handleGameStarted);
      socket.off('game:sync_broadcast', handleRemoteSync);
      socket.off('player:disconnected', handlePlayerDisconnected);
      socket.off('player:reconnected', handlePlayerReconnected);
      socket.off('room:rematch_update', handleRematchUpdate);
      socket.off('room:game_reset', handleGameReset);
      socket.off('turn:auto_passed', handleTurnAutoPassed);
      socket.off('room:player_left', handlePlayerLeft);
    };
  }, [engine]);

  // Sync state to other players when a local player mutates gameState
  useEffect(() => {
    if (isRemoteUpdateRef.current) {
      isRemoteUpdateRef.current = false;
      return;
    }
    if (gameMode === 'online' && onlineRoom && gameState.phase !== 'setup') {
      multiplayerService.syncState(onlineRoom.code, gameState);
    }
  }, [gameState, gameMode, onlineRoom]);

  // Turn timeout countdown timer
  useEffect(() => {
    if (turnTimeoutRemaining === null || turnTimeoutRemaining <= 0) return;
    const timer = setInterval(() => {
      setTurnTimeoutRemaining((prev) => (prev && prev > 1 ? prev - 1 : null));
    }, 1000);
    return () => clearInterval(timer);
  }, [turnTimeoutRemaining]);

  // Toast auto-dismiss after 4.5 seconds
  useEffect(() => {
    if (!toastMessage) return;
    const timer = setTimeout(() => {
      setToastMessage(null);
    }, 4500);
    return () => clearTimeout(timer);
  }, [toastMessage]);

  // Handle dice roll
  const handleRollDice = useCallback(() => {
    if (gameState.phase !== 'roll' || gameState.isRolling || !isMyTurn) return;
    engine.rollDice();
  }, [gameState.phase, gameState.isRolling, isMyTurn, engine]);

  // Keyboard shortcut: Space to roll dice
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Space' && gameState.phase === 'roll' && !gameState.isRolling && isMyTurn) {
        e.preventDefault();
        handleRollDice();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [gameState.phase, gameState.isRolling, isMyTurn, handleRollDice]);

  // Status message for the center board feed
  const statusMessage = useMemo(() => {
    if (turnTimeoutRemaining !== null && turnTimeoutRemaining > 0) {
      return `⚠️ Játékos kapcsolata megszakadt! Automatikus körátadás ${turnTimeoutRemaining} mp múlva...`;
    }
    if (gameMode === 'online' && !isMyTurn && activePlayer) {
      return `⏳ Várakozás: ${activePlayer.name} orvos köre van folyamatban...`;
    }
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
  }, [turnTimeoutRemaining, gameMode, isMyTurn, gameState.phase, activePlayer, currentTile]);

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

          {onlineRoom && (
            <div className="header-online-badge">
              <Wifi size={14} />
              <span>Szoba: <strong>{onlineRoom.code}</strong></span>
              {myRemotePlayer && (
                <span className="header-my-doctor" style={{ color: myRemotePlayer.color }}>
                  • {myRemotePlayer.name}
                </span>
              )}
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
              className="header-btn btn-menu"
              onClick={() => setIsGameMenuOpen(true)}
              title="Játék Menü"
            >
              <Menu size={16} />
              <span>Menü</span>
            </button>
          </div>
        )}
      </header>

      {/* ======================================================== */}
      {/* 2. SETUP SCREEN (When phase === 'setup') */}
      {/* ======================================================== */}
      {gameState.phase === 'setup' ? (
        gameMode === null ? (
          <MultiplayerLobby
            onStartLocalGame={() => setGameMode('local')}
            onStartOnlineGame={handleStartOnlineGame}
          />
        ) : (
          <main className="setup-container">
            <div className="setup-card">
              <div className="setup-back-bar">
                <button
                  type="button"
                  className="btn-back-mode"
                  onClick={() => setGameMode(null)}
                >
                  <ArrowLeft size={16} />
                  <span>Vissza a módválasztáshoz</span>
                </button>
              </div>
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
                        placeholder={`Pl. ${avatar.title} (Kovács Péter)`}
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
        )
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
            myPlayerId={gameMode === 'online' ? myRemotePlayer?.id : undefined}
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
                isRollDisabled={
                  !isMyTurn ||
                  gameState.phase !== 'roll' ||
                  gameState.isRolling ||
                  (engine.hasRolledThisTurn && !engine.extraRollAvailable)
                }
                onTileClick={(tile) => {
                  if (activePlayer && isMyTurn) {
                    engine.devTeleport(activePlayer.id, tile.id);
                  }
                }}
                statusMessage={statusMessage}
              />

              {/* Action Bar Beneath the Board */}
              <div className="board-turn-controls">
                {!isMyTurn && gameMode === 'online' ? (
                  <div className="waiting-turn-badge">
                    <span className="pulse-dot" />
                    <span>
                      Várakozás: <strong>{activePlayer?.name}</strong> orvos köre van folyamatban...
                    </span>
                  </div>
                ) : (
                  <>
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
                        <span>
                          🎲 Nyomj <strong>Space</strong> billentyűt vagy kattints a fenti kockára a dobáshoz!
                        </span>
                      </div>
                    )}
                  </>
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
        gameMode={gameMode}
        players={gameState.players}
        myPlayerId={myRemotePlayer?.id}
        rematchVotes={rematchVotes}
        onVoteRematch={(ready) => {
          if (gameMode === 'online' && onlineRoom) {
            multiplayerService.voteRematch(onlineRoom.code, ready);
          }
        }}
        onLeaveRoom={() => {
          if (gameMode === 'online' && onlineRoom) {
            multiplayerService.leaveRoom(onlineRoom.code);
            setOnlineRoom(null);
            setMyRemotePlayer(null);
          }
          engine.restartCurrentMatch();
          setGameMode(null);
        }}
      />

      {/* 4.5 In-Game Menu Modal */}
      <GameMenuModal
        isOpen={isGameMenuOpen}
        onClose={() => setIsGameMenuOpen(false)}
        gameMode={gameMode}
        isHost={!gameMode || gameMode === 'local' || !!myRemotePlayer?.isHost}
        soundEnabled={audio.soundEnabled}
        onToggleSound={() => audio.setSoundEnabled(!audio.soundEnabled)}
        onOpenDevPanel={() => setIsDevPanelOpen(true)}
        onRestartMatch={() => {
          if (gameMode === 'online' && onlineRoom) {
            multiplayerService.voteRematch(onlineRoom.code, true);
            setIsRematchPromptOpen(true);
            setToastMessage({
              id: Date.now(),
              text: 'Új meccset kezdeményeztél! Várakozás a többi játékos megerősítésére...',
              type: 'info',
            });
          } else {
            engine.restartCurrentMatch();
            setToastMessage({
              id: Date.now(),
              text: '🔄 Új meccs elindult a táblán a kiválasztott orvosokkal!',
              type: 'success',
            });
          }
        }}
        onExitToMainMenu={() => {
          if (gameMode === 'online' && onlineRoom) {
            multiplayerService.leaveRoom(onlineRoom.code);
            setOnlineRoom(null);
            setMyRemotePlayer(null);
          }
          engine.resetGame();
          setGameMode(null);
        }}
      />

      {/* 4.6 Rematch Prompt Modal for Multiplayer */}
      <RematchPromptModal
        isOpen={isRematchPromptOpen && gameMode === 'online' && !gameState.winner}
        requestedBy={rematchRequester?.name}
        isHostRequester={rematchRequester?.isHost}
        players={gameState.players}
        rematchVotes={rematchVotes}
        myPlayerId={myRemotePlayer?.id}
        onAccept={() => {
          if (onlineRoom) {
            multiplayerService.voteRematch(onlineRoom.code, true);
          }
        }}
        onDecline={() => {
          if (onlineRoom) {
            multiplayerService.voteRematch(onlineRoom.code, false);
          }
          setIsRematchPromptOpen(false);
        }}
      />

      {/* 4.5 Confirmation Exit / Rematch Modal */}
      <ConfirmExitModal
        isOpen={isConfirmExitOpen}
        onClose={() => setIsConfirmExitOpen(false)}
        gameMode={gameMode}
        isHost={!!myRemotePlayer?.isHost}
        onConfirmExit={() => {
          if (gameMode === 'online' && onlineRoom) {
            multiplayerService.leaveRoom(onlineRoom.code);
            setOnlineRoom(null);
            setMyRemotePlayer(null);
          }
          engine.resetGame();
          setGameMode(null);
        }}
        onRequestRematch={() => {
          if (gameMode === 'online' && onlineRoom) {
            multiplayerService.voteRematch(onlineRoom.code, true);
            setToastMessage({
              id: Date.now(),
              text: 'Visszavágót kértél! Várakozás a többi játékos megerősítésére...',
              type: 'info',
            });
          }
        }}
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

      {/* Live Toast Notifications */}
      {toastMessage && (
        <div className={`app-toast toast-${toastMessage.type}`}>
          <span>{toastMessage.text}</span>
        </div>
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
