import { useState } from 'react';
import { Activity, ArrowRight, Dices, Stethoscope } from 'lucide-react';
import { AVATARS } from '../../data/avatars.ts';
import { BOARD_TILES } from '../../data/tiles.ts';
import { useGameEngine } from '../../hooks/useGameEngine.ts';
import { useGameAudio } from '../../hooks/useGameAudio.ts';
import type { GamePhase, PlayerId } from '../../types/game.ts';
import { PlayerHUD } from '../HUD/PlayerHUD.tsx';
import { ClinicDashboard } from '../Clinic/ClinicDashboard.tsx';
import { CardModal } from '../Modals/CardModal.tsx';
import { GameOverModal } from '../Modals/GameOverModal.tsx';
import { DevPanel } from './DevPanel.tsx';
import './DemoScreen.css';

const PHASE_LABELS: Record<GamePhase, string> = {
  setup: 'Játék előkészítése',
  roll: 'Kockadobás',
  moving: 'Mozgás',
  tile_action: 'Mező eseménye',
  card_modal: 'Eseménykártya',
  bank_modal: 'Banki művelet',
  building: 'Építkezés és körzárás',
  turn_end: 'Kör vége',
  game_over: 'Győzelem',
};

// Külön bemutatóoldal a tesztpanel kipróbálásához.
export function DemoScreen() {
  const engine = useGameEngine();
  const { gameState, activePlayer } = engine;
  const audio = useGameAudio(gameState);
  const [playerCount, setPlayerCount] = useState(2);
  const tile = BOARD_TILES.find((candidate) => candidate.id === activePlayer?.position);

  const startDemo = () => engine.startGame(AVATARS.slice(0, playerCount).map((avatar, index) => ({
    id: `p${index + 1}` as PlayerId,
    name: avatar.title,
    avatar: avatar.id,
  })));

  return (
    <main className="demo-screen">
      <header className="demo-header">
        <div className="demo-brand"><Stethoscope aria-hidden="true" /><span>CODE<span>BLUE</span></span></div>
        <span className="demo-badge">Fejlesztői bemutató</span>
      </header>

      <section className="demo-intro" aria-labelledby="demo-title">
        <h1 id="demo-title">CodeBlue – bemutató</h1>
      </section>

      {gameState.phase === 'setup' ? (
        <section className="demo-start" aria-label="Bemutató indítása">
          <div><Activity aria-hidden="true" /><h2>Új játék</h2></div>
          <label htmlFor="demo-player-count">Játékosok száma</label>
          <select id="demo-player-count" value={playerCount} onChange={(event) => setPlayerCount(Number(event.target.value))}>
            <option value={2}>2 orvos</option><option value={3}>3 orvos</option><option value={4}>4 orvos</option>
          </select>
          <button type="button" className="demo-primary" onClick={startDemo}>Bemutató indítása <ArrowRight aria-hidden="true" /></button>
        </section>
      ) : (
        <>
          <PlayerHUD players={gameState.players} activePlayerIndex={gameState.activePlayerIndex} turnNumber={gameState.turnNumber} />
          <section className="demo-turn" aria-label="Aktuális játékállapot">
            <div>
              <p className="demo-eyebrow">{PHASE_LABELS[gameState.phase]}</p>
              <h2>{activePlayer?.name}</h2>
              <p>Aktuális mező: <strong>#{tile?.id} · {tile?.name}</strong></p>
              <p>{tile?.description}</p>
            </div>
            <div className="demo-turn-actions">
              {gameState.phase === 'roll' && (
                <button type="button" className="demo-primary" disabled={gameState.isRolling} onClick={engine.rollDice}>
                  <Dices aria-hidden="true" /> {gameState.isRolling ? 'Dobás folyamatban…' : 'Kockadobás'}
                </button>
              )}
              {gameState.phase === 'tile_action' && <button type="button" className="demo-primary" onClick={engine.resolveTileAction}>Mező eseményének végrehajtása</button>}
              {gameState.phase === 'building' && <button type="button" className="demo-primary" onClick={engine.endTurn}>Kör lezárása <ArrowRight aria-hidden="true" /></button>}
              {gameState.diceResult !== null && <span>Dobott érték: <strong>{gameState.diceResult}</strong></span>}
            </div>
          </section>
          <section className="demo-positions" aria-label="Bábuk aktuális pozíciója">
            {gameState.players.map((player) => (
              <div key={player.id}><span style={{ background: player.color }} aria-hidden="true" />{player.name}: <strong>#{player.position}</strong></div>
            ))}
          </section>
        </>
      )}

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

      {activePlayer && (
        <ClinicDashboard
          player={activePlayer}
          onBuyElement={engine.buyClinicElement}
          canBuyCheck={engine.canBuyElement}
          hasBuiltThisTurn={engine.hasBuiltThisTurn}
          isCurrentTurnActive={gameState.phase === 'building'}
        />
      )}

      <section className="demo-log" aria-labelledby="demo-log-title">
        <h2 id="demo-log-title">Eseménynapló</h2>
        <p className="demo-log-latest">{gameState.logs[0]?.message ?? 'Még nincs esemény.'}</p>
        <ol>{gameState.logs.slice(1, 6).map((log) => <li key={log.id}>{log.message}</li>)}</ol>
      </section>

      <CardModal card={gameState.drawnCard} isOpen={gameState.phase === 'card_modal'} onConfirm={engine.resolveCardAction} />
      <GameOverModal isOpen={gameState.phase === 'game_over'} winner={gameState.winner} turnNumber={gameState.turnNumber} onNewGame={engine.resetGame} />
    </main>
  );
}
