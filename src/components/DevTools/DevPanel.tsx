import { useId, useState } from 'react';
import { EVENT_CARDS } from '../../data/cards.ts';
import { BOARD_TILES } from '../../data/tiles.ts';
import type { CardCategory, GameState, PlayerId } from '../../types/game.ts';
import type { SoundEffect } from '../../utils/audio.ts';
import { canUseDevTools } from '../../utils/devTools.ts';
import './DevPanel.css';

interface DevPanelProps {
  gameState: GameState;
  onAdjustCash: (playerId: PlayerId, amount: number) => void;
  onTeleport: (playerId: PlayerId, tileId: number) => void;
  onDrawCard: (cardId: number) => void;
  onInstantVictory: () => void;
  soundEnabled: boolean;
  onSoundEnabledChange: (enabled: boolean) => void;
  onPreviewSound: (effect: SoundEffect) => void;
}

const CASH_STEP = 1_000_000;
const CARD_CATEGORIES: { id: CardCategory; label: string }[] = [
  { id: 'income', label: 'Bevétel' },
  { id: 'expense', label: 'Kiadás' },
  { id: 'advantage', label: 'Előny' },
  { id: 'disadvantage', label: 'Hátrány' },
];
const SOUND_PREVIEWS: { id: SoundEffect; label: string }[] = [
  { id: 'dice', label: 'Kockadobás' },
  { id: 'money', label: 'Bevétel' },
  { id: 'penalty', label: 'Kiadás / Bírság' },
  { id: 'build', label: 'Részlegépítés' },
  { id: 'siren', label: 'Mentősziréna' },
  { id: 'card', label: 'Kártyahúzás' },
  { id: 'victory', label: 'Győzelem' },
];

export function DevPanel({
  gameState,
  onAdjustCash,
  onTeleport,
  onDrawCard,
  onInstantVictory,
  soundEnabled,
  onSoundEnabledChange,
  onPreviewSound,
}: DevPanelProps) {
  const panelId = useId();
  const [selectedPlayerId, setSelectedPlayerId] = useState<PlayerId | ''>('');
  const [selectedTileId, setSelectedTileId] = useState(BOARD_TILES[0]?.id ?? 0);
  const [selectedCardId, setSelectedCardId] = useState(EVENT_CARDS[0]?.id ?? 1);
  const activePlayer = gameState.players[gameState.activePlayerIndex];
  const selectedPlayer = gameState.players.find((player) => player.id === selectedPlayerId)
    ?? activePlayer;
  const canUseGameActions = canUseDevTools(gameState);

  let availabilityMessage = '';
  if (gameState.winner || gameState.phase === 'game_over') {
    availabilityMessage = 'A játék véget ért. Indíts új játékot a további teszteléshez.';
  } else if (gameState.phase === 'setup' || !activePlayer) {
    availabilityMessage = 'A tesztműveletekhez előbb indíts játékot.';
  } else if (gameState.isRolling || gameState.phase === 'moving') {
    availabilityMessage = 'Várd meg a dobás és a lépés végét.';
  } else if (!canUseGameActions) {
    availabilityMessage = 'Előbb fejezd be az aktuális játékeseményt.';
  }

  return (
    <details className="dev-panel">
      <summary className="dev-panel__summary">
        <span className="dev-panel__summary-copy">
          <span className="dev-panel__title">Fejlesztői tesztpanel</span>
        </span>
      </summary>

      <div className="dev-panel__body">
        {availabilityMessage && (
          <p id={`${panelId}-availability`} className="dev-panel__notice" role="status">
            {availabilityMessage}
          </p>
        )}

        <fieldset
          className="dev-panel__fieldset"
          disabled={!canUseGameActions}
          aria-describedby={availabilityMessage ? `${panelId}-availability` : undefined}
        >
          <legend>Játékállapot</legend>

          <div className="dev-panel__player-picker">
            <label htmlFor={`${panelId}-player`}>Játékos</label>
            <select
              id={`${panelId}-player`}
              value={selectedPlayer?.id ?? ''}
              onChange={(event) => setSelectedPlayerId(event.target.value as PlayerId)}
            >
              {gameState.players.length === 0 && <option value="">Még nincs játékos</option>}
              {gameState.players.map((player) => (
                <option key={player.id} value={player.id}>
                  {player.name}{player.id === activePlayer?.id ? ' · soron lévő játékos' : ''}
                </option>
              ))}
            </select>
            <p className="dev-panel__help">
              {selectedPlayer
                ? `${selectedPlayer.cash.toLocaleString('hu-HU')} KK · ${selectedPlayer.position}. mező`
                : 'Még nincs játékos.'}
            </p>
          </div>

          <div className="dev-panel__grid">
            <section className="dev-panel__card" aria-labelledby={`${panelId}-cash-title`}>
              <h3 id={`${panelId}-cash-title`}>Egyenleg módosítása</h3>
              <div className="dev-panel__button-row">
                <button
                  className="dev-panel__button dev-panel__button--positive"
                  type="button"
                  disabled={!selectedPlayer}
                  onClick={() => selectedPlayer && onAdjustCash(selectedPlayer.id, CASH_STEP)}
                >
                  +1 000 000 KK
                </button>
                <button
                  className="dev-panel__button"
                  type="button"
                  disabled={!selectedPlayer || selectedPlayer.cash < CASH_STEP}
                  onClick={() => selectedPlayer && onAdjustCash(selectedPlayer.id, -CASH_STEP)}
                  aria-describedby={`${panelId}-cash-help`}
                >
                  −1 000 000 KK
                </button>
              </div>
              <p id={`${panelId}-cash-help`} className="dev-panel__help">A levonáshoz legalább 1 000 000 KK szükséges.</p>
            </section>

            <section className="dev-panel__card" aria-labelledby={`${panelId}-teleport-title`}>
              <h3 id={`${panelId}-teleport-title`}>Ugrás bármelyik mezőre</h3>
              <label htmlFor={`${panelId}-tile`}>Célmező</label>
              <select
                id={`${panelId}-tile`}
                value={selectedTileId}
                onChange={(event) => setSelectedTileId(Number(event.target.value))}
              >
                {BOARD_TILES.map((tile) => (
                  <option key={tile.id} value={tile.id}>{tile.id}. {tile.name}</option>
                ))}
              </select>
              <button
                className="dev-panel__button"
                type="button"
                disabled={!selectedPlayer}
                onClick={() => selectedPlayer && onTeleport(selectedPlayer.id, selectedTileId)}
                aria-describedby={`${panelId}-teleport-help`}
              >
                Bábu áthelyezése
              </button>
              <p id={`${panelId}-teleport-help`} className="dev-panel__help">Áthelyezés mezőhatás és START-bónusz nélkül.</p>
            </section>

            <section className="dev-panel__card" aria-labelledby={`${panelId}-card-title`}>
              <h3 id={`${panelId}-card-title`}>Kártyahúzás</h3>
              <p>Kártyát kap: <strong>{activePlayer?.name ?? '—'}</strong></p>
              <label htmlFor={`${panelId}-card`}>Eseménykártya</label>
              <select
                id={`${panelId}-card`}
                value={selectedCardId}
                onChange={(event) => setSelectedCardId(Number(event.target.value))}
              >
                {CARD_CATEGORIES.map((category) => (
                  <optgroup key={category.id} label={category.label}>
                    {EVENT_CARDS.filter((card) => card.category === category.id).map((card) => (
                      <option key={card.id} value={card.id}>{card.id}. {card.title}</option>
                    ))}
                  </optgroup>
                ))}
              </select>
              <button className="dev-panel__button" type="button" onClick={() => onDrawCard(selectedCardId)}>
                Kártya megnyitása
              </button>
              <p className="dev-panel__help">A hatás a kártya jóváhagyásakor érvényesül.</p>
            </section>

            <section className="dev-panel__card dev-panel__card--victory" aria-labelledby={`${panelId}-victory-title`}>
              <h3 id={`${panelId}-victory-title`}>Azonnali győzelem</h3>
              <p>Győztes: <strong>{activePlayer?.name ?? '—'}</strong></p>
              <p className="dev-panel__help">Beállítja a 8 részleget, a tartaléktőkét és a tartozásmentességet.</p>
              <button className="dev-panel__button dev-panel__button--victory" type="button" onClick={onInstantVictory}>
                Győzelem bemutatása
              </button>
            </section>
          </div>
        </fieldset>

        <fieldset className="dev-panel__fieldset dev-panel__sound">
          <legend>Hangeffektek</legend>
          <label className="dev-panel__sound-toggle" htmlFor={`${panelId}-sound`}>
            <input
              id={`${panelId}-sound`}
              type="checkbox"
              role="switch"
              checked={soundEnabled}
              onChange={(event) => onSoundEnabledChange(event.target.checked)}
            />
            <span>Hang bekapcsolva</span>
          </label>
          <div className="dev-panel__sound-grid">
            {SOUND_PREVIEWS.map((effect) => (
              <button
                key={effect.id}
                className="dev-panel__button"
                type="button"
                disabled={!soundEnabled}
                onClick={() => onPreviewSound(effect.id)}
                aria-label={`${effect.label} hangjának lejátszása`}
              >
                {effect.label}
              </button>
            ))}
          </div>
        </fieldset>

        <p className="dev-panel__log" aria-live="polite" aria-atomic="true">
          <span>Legutóbbi esemény</span>
          {gameState.logs[0]?.message ?? 'Még nincs esemény.'}
        </p>
      </div>
    </details>
  );
}

export default DevPanel;
