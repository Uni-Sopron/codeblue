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
  Bot,
  Pause,
} from 'lucide-react';
import { BOARD_TILES } from './data/tiles.ts';
import { AVATARS } from './data/avatars.ts';
import { canUseBank } from './utils/bank.ts';
import { useGameEngine } from './hooks/useGameEngine.ts';
import { useGameAudio } from './hooks/useGameAudio.ts';
import { useBotPlayer } from './hooks/useBotPlayer.ts';
import { createLocalPlayerConfigs } from './data/botProfiles.ts';
import type { LocalPlayerType } from './data/botProfiles.ts';
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
  const { gameState, activePlayer, startGame, setFullGameState } = engine;
  const audio = useGameAudio(gameState);

  // Modal and panel visibility states
  const [isClinicOpen, setIsClinicOpen] = useState(false);
  const [isBankOpen, setIsBankOpen] = useState(false);
  const [isDevPanelOpen, setIsDevPanelOpen] = useState(false);
  const clinicModalRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isClinicOpen) return;
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    clinicModalRef.current?.focus();
    return () => {
      document.body.style.overflow = previousOverflow;
      previousFocus?.focus();
    };
  }, [isClinicOpen]);

  const [isConfirmExitOpen, setIsConfirmExitOpen] = useState(false);
  const [isGameMenuOpen, setIsGameMenuOpen] = useState(false);
  const [isRematchPromptOpen, setIsRematchPromptOpen] = useState(false);
  const [rematchRequester, setRematchRequester] = useState<{ name: string; isHost: boolean } | null>(null);


  // Multiplayer and game mode state
  const [gameMode, setGameMode] = useState<'local' | 'online' | null>(null);
  const [onlineRoom, setOnlineRoom] = useState<MultiplayerRoom | null>(null);
  const onlineRoomCode = onlineRoom?.code;
  const [myRemotePlayer, setMyRemotePlayer] = useState<RemotePlayer | null>(null);
  const [onlineSocketId, setOnlineSocketId] = useState<string | null>(null);
  const [areBotsPaused, setAreBotsPaused] = useState(false);
  const [rematchVotes, setRematchVotes] = useState<Record<string, boolean>>({});
  const [turnTimeoutRemaining, setTurnTimeoutRemaining] = useState<number | null>(null);
  const [toastMessage, setToastMessage] = useState<{ id: number; text: string; type: 'info' | 'warning' | 'success' } | null>(null);
  const isRemoteUpdateRef = useRef(false);

  // Setup state (for local hotseat)
  const [playerCount, setPlayerCount] = useState<number>(4);
  const [playerTypes, setPlayerTypes] = useState<LocalPlayerType[]>(['human', 'bot', 'bot', 'bot']);
  const [playerNames, setPlayerNames] = useState<string[]>([
    '1. Orvos',
    '2. Orvos',
    '3. Orvos',
    '4. Orvos',
  ]);

  // Determine if it is currently my turn
  const isMyTurn = useMemo(() => {
    if (activePlayer?.isAI) return false;
    if (gameMode !== 'online') return true;
    if (!myRemotePlayer || !activePlayer || !onlineSocketId) return false;
    return activePlayer.id === myRemotePlayer.id;
  }, [gameMode, myRemotePlayer, activePlayer, onlineSocketId]);

  const isOnlineHost = !!onlineSocketId && onlineRoom?.hostSocketId === onlineSocketId;
  const canDriveBots = gameMode === 'local' || (gameMode === 'online' && isOnlineHost);
  const botsPaused = areBotsPaused || isGameMenuOpen || isConfirmExitOpen || isRematchPromptOpen
    || isDevPanelOpen || isBankOpen || isClinicOpen;
  useBotPlayer(engine, { enabled: canDriveBots, paused: botsPaused });

  const localConfigs = useMemo(
    () => createLocalPlayerConfigs(playerCount, playerTypes, playerNames),
    [playerCount, playerTypes, playerNames],
  );

  // Current tile of active player
  const currentTile = useMemo(() => {
    if (!activePlayer) return undefined;
    return BOARD_TILES[activePlayer.position];
  }, [activePlayer]);

  // Handle local game start
  const handleStartGame = () => {
    if (localConfigs.length !== playerCount) return;
    setAreBotsPaused(false);
    startGame(localConfigs);
  };

  // Handle online game start callback from lobby
  const handleStartOnlineGame = useCallback(
    (startedRoom: MultiplayerRoom, me: RemotePlayer) => {
      setGameMode('online');
      setOnlineRoom(startedRoom);
      setMyRemotePlayer(me);

      if (startedRoom.gameState) {
        isRemoteUpdateRef.current = true;
        setFullGameState(startedRoom.gameState);
        return;
      }

      const configs = startedRoom.players.map((p, idx) => {
        const avatarInfo = AVATARS.find((a) => a.id === p.avatar) || AVATARS[idx % AVATARS.length];
        return {
          id: p.id as PlayerId,
          name: p.name,
          avatar: avatarInfo.id,
          color: p.color || avatarInfo.color,
          isAI: 'isAI' in p && p.isAI === true,
        };
      });
      startGame(configs);
    },
    [startGame, setFullGameState]
  );

  // Socket listeners for game start and state synchronization
  useEffect(() => {
    const socket = multiplayerService.getSocket();

    const handleConnected = () => setOnlineSocketId(socket.id ?? null);
    const handleDisconnected = () => setOnlineSocketId(null);
    const handleRoomUpdated = ({ room }: { room: MultiplayerRoom }) => {
      setOnlineRoom((previous) => previous?.code === room.code ? room : previous);
      const me = room.players.find((player) => player.socketId === socket.id);
      if (me) setMyRemotePlayer(me);
    };

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
        setFullGameState(initialGameState);
      } else if (startedRoom.gameState) {
        isRemoteUpdateRef.current = true;
        setFullGameState(startedRoom.gameState);
      } else {
        const configs = startedRoom.players.map((p, idx) => {
          const avatarInfo = AVATARS.find((a) => a.id === p.avatar) || AVATARS[idx % AVATARS.length];
          return {
            id: p.id as PlayerId,
            name: p.name,
            avatar: avatarInfo.id,
            color: p.color || avatarInfo.color,
            isAI: 'isAI' in p && p.isAI === true,
          };
        });
        startGame(configs);
      }
    };

    const handleRemoteSync = ({ gameState: remoteState }: { gameState: GameState }) => {
      if (remoteState) {
        isRemoteUpdateRef.current = true;
        setFullGameState(remoteState);
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
      setFullGameState((prev: GameState) => ({
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
      setFullGameState((prev: GameState) => ({
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

    const handleRematchCancelled = ({
      cancelledBy,
    }: {
      cancelledBy: string;
      cancelledById?: string;
    }) => {
      setIsRematchPromptOpen(false);
      setRematchVotes({});
      setRematchRequester(null);
      setToastMessage({
        id: Date.now(),
        text: `❌ ${cancelledBy || 'A másik játékos'} nem fogadta el az új meccset. A jelenlegi játék folytatódik!`,
        type: 'warning',
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
      setFullGameState(resetGameState);
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
        setFullGameState(updatedState);
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

    socket.on('connect', handleConnected);
    socket.on('disconnect', handleDisconnected);
    socket.on('room:update', handleRoomUpdated);
    // A kapcsolat egy korábbi lobby-újrarenderelésből már élhet.
    if (socket.connected) handleConnected();
    socket.on('game:started', handleGameStarted);
    socket.on('game:sync_broadcast', handleRemoteSync);
    socket.on('player:disconnected', handlePlayerDisconnected);
    socket.on('player:reconnected', handlePlayerReconnected);
    socket.on('room:rematch_update', handleRematchUpdate);
    socket.on('room:rematch_cancelled', handleRematchCancelled);
    socket.on('room:game_reset', handleGameReset);
    socket.on('turn:auto_passed', handleTurnAutoPassed);
    socket.on('room:player_left', handlePlayerLeft);

    return () => {
      socket.off('connect', handleConnected);
      socket.off('disconnect', handleDisconnected);
      socket.off('room:update', handleRoomUpdated);
      socket.off('game:started', handleGameStarted);
      socket.off('game:sync_broadcast', handleRemoteSync);
      socket.off('player:disconnected', handlePlayerDisconnected);
      socket.off('player:reconnected', handlePlayerReconnected);
      socket.off('room:rematch_update', handleRematchUpdate);
      socket.off('room:rematch_cancelled', handleRematchCancelled);
      socket.off('room:game_reset', handleGameReset);
      socket.off('turn:auto_passed', handleTurnAutoPassed);
      socket.off('room:player_left', handlePlayerLeft);
    };
  }, [startGame, setFullGameState]);

  // Sync state to other players when a local player mutates gameState
  useEffect(() => {
    if (isRemoteUpdateRef.current) {
      isRemoteUpdateRef.current = false;
      return;
    }
    if (gameMode === 'online' && onlineRoomCode && gameState.phase !== 'setup') {
      multiplayerService.syncState(onlineRoomCode, gameState);
    }
  }, [gameState, gameMode, onlineRoomCode]);

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

  // Keyboard shortcut: Unified Space primary loop (Roll -> Confirm Card -> End Turn)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.repeat) return;
      if (
        isBankOpen ||
        isClinicOpen ||
        isDevPanelOpen ||
        isGameMenuOpen ||
        (e.target instanceof HTMLElement && e.target.closest('input, textarea, select, button, [role="dialog"]'))
      ) {
        return;
      }

      if (e.code === 'Space' && isMyTurn) {
        if (gameState.phase === 'roll' && !gameState.isRolling) {
          e.preventDefault();
          handleRollDice();
        } else if (gameState.phase === 'card_modal') {
          e.preventDefault();
          engine.resolveCardAction();
        } else if (gameState.phase === 'building') {
          e.preventDefault();
          engine.endTurn();
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [
    gameState.phase,
    gameState.isRolling,
    isMyTurn,
    handleRollDice,
    engine,
    isBankOpen,
    isClinicOpen,
    isDevPanelOpen,
    isGameMenuOpen,
  ]);

  // Status message for the center board feed
  const statusMessage = useMemo(() => {
    if (turnTimeoutRemaining !== null && turnTimeoutRemaining > 0) {
      return `⚠️ Játékos kapcsolata megszakadt! Automatikus körátadás ${turnTimeoutRemaining} mp múlva...`;
    }
    if (activePlayer?.isAI) {
      return canDriveBots && botsPaused
        ? 'A bot szünetel.'
        : `${activePlayer.name} [BOT] gondolkodik…`;
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
      return 'Építkezési lehetőség! Vásárolj új részleget a klinikádhoz vagy fejezd be a köröd (Space)!';
    }
    if (gameState.phase === 'card_modal') {
      return 'Eseménykártya felhúzva! Olvasd el a lapot a folytatáshoz (Space vagy jóváhagyás).';
    }
    return undefined;
  }, [turnTimeoutRemaining, gameMode, isMyTurn, gameState.phase, activePlayer, currentTile, canDriveBots, botsPaused]);

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
            {canDriveBots && gameState.players.some((player) => player.isAI) && (
              <button
                type="button"
                className={`header-btn ${areBotsPaused ? 'btn-active' : ''}`}
                onClick={() => setAreBotsPaused((previous) => !previous)}
                aria-pressed={areBotsPaused}
                title={areBotsPaused ? 'Botok folytatása' : 'Botok szüneteltetése'}
              >
                {areBotsPaused ? <Play size={16} /> : <Pause size={16} />}
                <span>{areBotsPaused ? 'Botok folytatása' : 'Botok szünet'}</span>
              </button>
            )}
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
              title="Fejlesztői bemutató és tesztpanel"
            >
              <Wrench size={16} />
              <span>Fejlesztői Mód</span>
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
                                <div className="setup-preset-buttons" role="group" aria-label="Gyors játékmód sablonok">
                  <button
                    type="button"
                    className="setup-preset-btn"
                    onClick={() => setPlayerTypes(['bot', 'bot', 'bot', 'bot'])}
                    title="Minden játékost bot irányít (Nézői bemutató meccs)"
                  >
                    🤖 Teljes Bot Harc (Demó)
                  </button>
                  <button
                    type="button"
                    className="setup-preset-btn"
                    onClick={() => setPlayerTypes(['human', 'bot', 'bot', 'bot'])}
                    title="1 emberi játékos a mesterséges intelligencia ellen"
                  >
                    👤 1 Ember + Botok
                  </button>
                  <button
                    type="button"
                    className="setup-preset-btn"
                    onClick={() => setPlayerTypes(['human', 'human', 'human', 'human'])}
                    title="Minden orvost emberi játékos irányít helyben (Hotseat)"
                  >
                    👥 Hotseat (Csak Emberek)
                  </button>
                </div>
                <p className="setup-bot-help">
                  {playerTypes.slice(0, playerCount).every((t) => t === 'bot')
                    ? '🤖 Teljes Bot Demó mód aktív: az AI orvosok automatikusan fognak egymással játszani nézői módban.'
                    : 'Válassz gyors sablont vagy állítsd be orvosonként, hogy Ember vagy Bot irányítsa!'}
                </p>
              </div>

              <div className="setup-players-grid">
                {localConfigs.map((config, idx) => {
                  const avatar = AVATARS.find((candidate) => candidate.id === config.avatar)!;
                  // Every slot can be freely toggled between human and bot
                  return (
                  <div
                    key={config.id}
                    className={`setup-player-card ${config.isAI ? 'setup-player-card--bot' : ''}`}
                    style={{ borderColor: config.color }}
                  >
                    <img
                      src={avatar.image || '/assets/board_center.jpg'}
                      alt={config.name}
                      className="setup-player-avatar"
                      style={{ borderColor: avatar.color }}
                    />
                    <div className="setup-player-info">
                      <div className="setup-player-type" role="group" aria-label={`${idx + 1}. orvos típusa`}>
                        {(['human', 'bot'] as const).map((type) => (
                          <button
                            key={type}
                            type="button"
                            aria-pressed={playerTypes[idx] === type}
                            disabled={false}
                            onClick={() => setPlayerTypes((previous) => previous.map((value, index) => index === idx ? type : value))}
                          >
                            {type === 'bot' && <Bot size={13} />}
                            {type === 'human' ? 'Ember' : 'Bot'}
                          </button>
                        ))}
                      </div>
                      <span className="setup-player-role" style={{ color: avatar.color }}>
                        {avatar.title}{config.isAI ? ' · [BOT]' : ''}
                      </span>
                      <input
                        type="text"
                        className="setup-player-name-input"
                        value={config.isAI ? config.name : playerNames[idx]}
                        readOnly={config.isAI}
                        aria-label={`${idx + 1}. orvos neve`}
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
                ); })}
              </div>

              <button
                type="button"
                className="btn-start-game"
                onClick={handleStartGame}
                disabled={localConfigs.length !== playerCount}
              >
                <Play size={20} />
                <span>{playerTypes.slice(0, playerCount).every((t) => t === 'bot') ? '🤖 Bot Demó Indítása (Nézői Mód)' : 'Játék Indítása'}</span>
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
                  (engine.hasRolledThisTurn && !engine.extraRollAvailable && !gameState.extraRollAvailable)
                }
                onTileClick={(tile) => {
                  if (isDevPanelOpen && activePlayer && isMyTurn) {
                    engine.devTeleport(activePlayer.id, tile.id);
                  }
                }}
                statusMessage={statusMessage}
              />

              {/* Action Bar Beneath the Board */}
              <div className="board-turn-controls">
                {!isMyTurn ? (
                  <div className="waiting-turn-badge">
                    <span className="pulse-dot" />
                    <span>
                      {gameState.players.every((p) => p.isAI) ? (
                        <>
                          <strong>🤖 Botok autonóm meccse zajlik (Nézői mód)</strong>
                          {activePlayer?.isAI && canDriveBots && botsPaused
                            ? ' · A botok szünetelnek.'
                            : ` · Éppen ${activePlayer?.name ?? 'orvos'} köre fut…`}
                        </>
                      ) : (
                        <>
                          <strong>{activePlayer?.name}</strong>{activePlayer?.isAI ? ' [BOT]' : ''}
                          {activePlayer?.isAI && canDriveBots && botsPaused ? ' · A bot szünetel.' : ' orvos köre van folyamatban…'}
                        </>
                      )}
                    </span>
                  </div>
                ) : (
                  <>
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
                          className="action-btn-primary action-btn-end-turn"
                          onClick={engine.endTurn}
                          title="Kör Befejezése (Space billentyű vagy kattintás)"
                        >
                          <span>Kör Befejezése</span>
                          <ArrowRight size={18} />
                          <kbd className="space-key-hint">Space</kbd>
                        </button>
                      </div>
                    )}

                    {gameState.phase === 'roll' && (
                      <button
                        type="button"
                        className="action-btn-primary action-btn-roll"
                        onClick={handleRollDice}
                        disabled={gameState.isRolling || !isMyTurn}
                        title="Kockadobás a lépéshez (Space billentyű vagy kattintás)"
                      >
                        <Play size={18} />
                        <span>{gameState.isRolling ? 'Kockadobás...' : 'Kockadobás'}</span>
                        <kbd className="space-key-hint">Space</kbd>
                      </button>
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
        onConfirm={() => { if (isMyTurn) engine.resolveCardAction(); }}
      />

      {/* 4.2 Bank / Debt Modal */}
      <BankModal
        isOpen={isBankOpen || gameState.phase === 'bank_modal'}
        onClose={() => setIsBankOpen(false)}
        player={activePlayer}
        canTransact={isMyTurn && canUseBank(gameState)}
        onTakeLoan={(amount) => { if (isMyTurn) engine.takeLoan(amount); }}
        onRepayLoan={(amount) => { if (isMyTurn) engine.repayLoan(amount); }}
        onDeposit={(product, amount) => { if (isMyTurn) engine.depositBank(product, amount); }}
        onWithdraw={(product, amount) => { if (isMyTurn) engine.withdrawBank(product, amount); }}
      />

      {/* 4.3 Clinic Dashboard / Blueprint View */}
      {isClinicOpen && activePlayer && (
        <div className="clinic-modal-backdrop" onClick={() => setIsClinicOpen(false)}>
          <div className="clinic-modal-content" ref={clinicModalRef} role="dialog" aria-modal="true" aria-labelledby="clinic-modal-title" tabIndex={-1}
            onClick={(e) => e.stopPropagation()}
            onKeyDown={(e) => {
              if (e.key === 'Escape') { e.stopPropagation(); setIsClinicOpen(false); }
              if (e.key !== 'Tab') return;
              const controls = clinicModalRef.current?.querySelectorAll<HTMLElement>('button:not(:disabled)');
              if (!controls?.length) return;
              const first = controls[0];
              const last = controls[controls.length - 1];
              if (e.shiftKey && (document.activeElement === first || document.activeElement === clinicModalRef.current)) { e.preventDefault(); last.focus(); }
              else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
              else if (!e.shiftKey && document.activeElement && !Array.from(controls).some((control) => document.activeElement!.compareDocumentPosition(control) & Node.DOCUMENT_POSITION_FOLLOWING)) {
                e.preventDefault();
                first.focus();
              }
            }}>
            <div className="clinic-modal-header">
              <div className="clinic-header-info">
                <h2 id="clinic-modal-title">{activePlayer.name} Klinikája</h2>
                <span style={{ color: activePlayer.color }}>{activePlayer.avatarTitle}</span>
              </div>
              <button
                type="button"
                className="clinic-modal-close"
                aria-label="Klinika bezárása"
                onClick={() => setIsClinicOpen(false)}
              >
                ✕
              </button>
            </div>
            <ClinicDashboard
              player={activePlayer}
              onBuyElement={(elementId) => { if (isMyTurn) engine.buyClinicElement(elementId); }}
              canBuyCheck={engine.canBuyElement}
              hasBuiltThisTurn={engine.hasBuiltThisTurn}
              isCurrentTurnActive={isMyTurn && gameState.phase === 'building'}
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
          engine.resetGame();
          setGameMode(null);
        }}
      />

      {/* 4.5 In-Game Menu Modal */}
      <GameMenuModal
        isOpen={isGameMenuOpen}
        onClose={() => setIsGameMenuOpen(false)}
        gameMode={gameMode}
        isHost={gameMode !== 'online' || isOnlineHost}
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
        isHost={isOnlineHost}
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
