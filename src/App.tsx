import { useState, useRef, useEffect, useCallback } from 'react';
import type { Player, Tile as TileType } from './types/game.ts';
import { BOARD_TILES } from './data/tiles.ts';
import { AVATARS } from './data/avatars.ts';
import { GameBoard } from './components/Board/GameBoard.tsx';
import { Users, RotateCcw, ArrowRight, Sparkles } from 'lucide-react';
import './App.css';

// Initial Mock Players based on the 4 Doctor Avatars
const INITIAL_PLAYERS: Player[] = [
  {
    id: 'p1',
    name: 'Péter',
    avatar: 'surgeon',
    avatarTitle: 'Dr. Sebész',
    color: '#0284c7', // Sky Blue / Cyan
    cash: 1_500_000,
    debt: 0,
    position: 0,
    builtElements: [],
    skipTurns: 0,
    activeBuffs: [],
  },
  {
    id: 'p2',
    name: 'Markó',
    avatar: 'diagnostician',
    avatarTitle: 'Dr. Diagnoszta',
    color: '#0d9488', // Teal
    cash: 1_500_000,
    debt: 0,
    position: 0,
    builtElements: [],
    skipTurns: 0,
    activeBuffs: [],
  },
  {
    id: 'p3',
    name: 'Anna',
    avatar: 'chief_physician',
    avatarTitle: 'Dr. Főorvos',
    color: '#6366f1', // Indigo / Purple
    cash: 1_500_000,
    debt: 0,
    position: 0,
    builtElements: [],
    skipTurns: 0,
    activeBuffs: [],
  },
  {
    id: 'p4',
    name: 'Bence',
    avatar: 'resident',
    avatarTitle: 'Dr. Rezidens',
    color: '#d97706', // Amber / Gold
    cash: 1_500_000,
    debt: 0,
    position: 0,
    builtElements: [],
    skipTurns: 0,
    activeBuffs: [],
  },
];

export function App() {
  const [playerCount, setPlayerCount] = useState<number>(4);
  const [players, setPlayers] = useState<Player[]>(INITIAL_PLAYERS);
  const [activePlayerIndex, setActivePlayerIndex] = useState<number>(0);
  const [diceResult, setDiceResult] = useState<number | null>(null);
  const [isRolling, setIsRolling] = useState<boolean>(false);
  const [isMoving, setIsMoving] = useState<boolean>(false);
  const [statusMessage, setStatusMessage] = useState<string>('Dobj a kockával a lépéshez!');

  const activePlayer = players[activePlayerIndex];

  // Active player slice according to playerCount
  const visiblePlayers = players.slice(0, playerCount);

  // Sound / Audio Chime using Web Audio API
  const playChime = (freq = 520, type: OscillatorType = 'sine', duration = 0.15) => {
    try {
      const audioCtx = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(freq, audioCtx.currentTime);
      gain.gain.setValueAtTime(0.12, audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + duration);
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.start();
      osc.stop(audioCtx.currentTime + duration);
    } catch {
      // AudioContext muted/unsupported
    }
  };

  // Step-by-step smooth pawn movement
  const isMovingRef = useRef(false);

  const movePlayerSteps = useCallback((playerId: string, steps: number) => {
    isMovingRef.current = true;
    setIsMoving(true);

    let currentStep = 0;
    setStatusMessage(`Lépkedés: ${steps} mező előre...`);

    const interval = setInterval(() => {
      currentStep++;

      setPlayers((prev) =>
        prev.map((p) => {
          if (p.id !== playerId) return p;
          const nextPos = (p.position + 1) % BOARD_TILES.length;

          // Check if passed START (tile 0) during this step
          let updatedCash = p.cash;
          if (nextPos === 0) {
            updatedCash += 300_000;
            playChime(780, 'triangle', 0.25);
          } else {
            playChime(420, 'sine', 0.08);
          }

          return {
            ...p,
            position: nextPos,
            cash: updatedCash,
          };
        })
      );

      if (currentStep >= steps) {
        clearInterval(interval);
        isMovingRef.current = false;
        setIsMoving(false);

        // Final arrival processing
        setTimeout(() => {
          setPlayers((finalPlayers) => {
            const landedPlayer = finalPlayers.find((p) => p.id === playerId);
            if (landedPlayer) {
              const landedTile = BOARD_TILES[landedPlayer.position];
              setStatusMessage(`Érkezés: ${landedTile.name} – ${landedTile.description}`);
            }
            return finalPlayers;
          });
        }, 100);
      }
    }, 280);
  }, []);

  // Handle Dice Roll
  const handleRollDice = useCallback((result: number) => {
    if (isRolling || isMoving) return;
    setIsRolling(true);
    setDiceResult(result);
    playChime(320, 'sawtooth', 0.1);

    setTimeout(() => {
      setIsRolling(false);
      movePlayerSteps(activePlayer.id, result);
    }, 700);
  }, [isRolling, isMoving, activePlayer.id, movePlayerSteps]);

  // Next Turn Button
  const handleNextTurn = () => {
    if (isMoving || isRolling) return;
    setActivePlayerIndex((prev) => (prev + 1) % playerCount);
    setDiceResult(null);
    setStatusMessage('Új kör kezdődött. Dobj a kockával!');
    playChime(580, 'sine', 0.12);
  };

  // Reset Game
  const handleResetGame = () => {
    setPlayers(INITIAL_PLAYERS);
    setActivePlayerIndex(0);
    setDiceResult(null);
    setIsRolling(false);
    setIsMoving(false);
    setStatusMessage('A játék újraindult a START mezőről!');
  };

  // Teleport to Tile for testing
  const handleTeleportToTile = (tile: TileType) => {
    if (isMoving || isRolling) return;
    setPlayers((prev) =>
      prev.map((p, idx) => (idx === activePlayerIndex ? { ...p, position: tile.id } : p))
    );
    setStatusMessage(`[Teszt] ${activePlayer.name} átteleportálva a(z) ${tile.id}. mezőre: ${tile.name}`);
    playChime(640, 'triangle', 0.15);
  };

  useEffect(() => {
    // Keyboard Space to roll dice
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Space' && !isRolling && !isMoving) {
        e.preventDefault();
        const rand = Math.floor(Math.random() * 6) + 1;
        handleRollDice(rand);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isRolling, isMoving, handleRollDice]);

  return (
    <div className="app-container">
      {/* Top Header / Player HUD */}
      <header className="app-header">
        <div className="header-left">
          <div className="brand-logo">
            <span className="brand-icon">✚</span>
            <div className="brand-text">
              <span className="brand-title">CodeBlue</span>
              <span className="brand-sub">Magánklinika</span>
            </div>
          </div>

          <div className="player-count-picker">
            <Users size={16} />
            <span className="picker-label">Játékosok:</span>
            {[2, 3, 4].map((count) => (
              <button
                key={count}
                type="button"
                className={`count-btn ${playerCount === count ? 'active' : ''}`}
                onClick={() => {
                  setPlayerCount(count);
                  if (activePlayerIndex >= count) setActivePlayerIndex(0);
                }}
              >
                {count} fő
              </button>
            ))}
          </div>
        </div>

        {/* Players Summary Cards */}
        <div className="header-players-bar">
          {visiblePlayers.map((p, idx) => {
            const avatarInfo = AVATARS.find((a) => a.id === p.avatar);
            const isActive = idx === activePlayerIndex;

            return (
              <div
                key={p.id}
                className={`player-summary-chip ${isActive ? 'chip-active' : ''}`}
                style={{ borderColor: p.color }}
                onClick={() => !isMoving && setActivePlayerIndex(idx)}
                title="Kattints a soron lévő játékos váltásához"
              >
                {avatarInfo?.image && (
                  <img src={avatarInfo.image} alt={p.name} className="chip-avatar" />
                )}
                <div className="chip-details">
                  <span className="chip-name" style={{ color: p.color }}>
                    {p.name}
                  </span>
                  <span className="chip-cash">{p.cash.toLocaleString('hu-HU')} KK</span>
                </div>
                {isActive && <span className="chip-badge">KÖRÖN</span>}
              </div>
            );
          })}
        </div>

        {/* Controls */}
        <div className="header-actions">
          <button
            type="button"
            className="action-btn next-turn-btn"
            onClick={handleNextTurn}
            disabled={isMoving || isRolling}
          >
            <span>Kör Átadása</span>
            <ArrowRight size={16} />
          </button>

          <button
            type="button"
            className="action-btn reset-btn"
            onClick={handleResetGame}
            title="Játék újraindítása"
          >
            <RotateCcw size={16} />
          </button>
        </div>
      </header>

      {/* Main Interactive Board */}
      <main className="app-main">
        <GameBoard
          tiles={BOARD_TILES}
          players={visiblePlayers}
          activePlayerIndex={activePlayerIndex}
          diceResult={diceResult}
          isRolling={isRolling}
          isMoving={isMoving}
          onRollDice={handleRollDice}
          onTileClick={handleTeleportToTile}
          statusMessage={statusMessage}
        />
      </main>

      {/* Footer Info & Quick Tip */}
      <footer className="app-footer">
        <div className="footer-tip">
          <Sparkles size={14} className="tip-icon" />
          <span>
            <strong>Tipp:</strong> Nyomd meg a <code>Space</code> (Szóköz) gombot a gyors kockadobáshoz, vagy kattints bármelyik mezőre a táblán az azonnali ugráshoz!
          </span>
        </div>
        <div className="footer-meta">
          <span>Soproni Egyetem Hackathon 2026</span> • <span>CodeBlue Csapat</span>
        </div>
      </footer>
    </div>
  );
}

export default App;
