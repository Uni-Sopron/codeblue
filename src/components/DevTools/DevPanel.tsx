import { useEffect, useId, useRef, useState } from 'react';
import { EVENT_CARDS } from '../../data/cards.ts';
import { BOARD_TILES } from '../../data/tiles.ts';
import type { CardCategory, GameState, PlayerId } from '../../types/game.ts';
import type { SoundEffect } from '../../utils/audio.ts';
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
const SOUND_PREVIEWS: { id: SoundEffect; label: string; hint: string }[] = [
  { id: 'dice', label: 'Kockadobás', hint: 'Kocka csörgése' },
  { id: 'money', label: 'Pénzmozgás', hint: 'Pénztár csilingelése' },
  { id: 'card', label: 'Kártyahúzás', hint: 'Kártya suhanása' },
  { id: 'victory', label: 'Győzelem', hint: 'Győzelmi fanfár' },
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
  const [commandBusy, setCommandBusy] = useState(false);
  const commandLock = useRef(false);
  const unlockTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => {
    if (unlockTimer.current !== null) clearTimeout(unlockTimer.current);
  }, []);

  const activePlayer = gameState.players[gameState.activePlayerIndex];
  const selectedPlayer = gameState.players.find((player) => player.id === selectedPlayerId)
    ?? activePlayer;
  const canUseGameActions = Boolean(activePlayer)
    && (gameState.phase === 'roll' || gameState.phase === 'building')
    && !gameState.isRolling
    && !gameState.winner;

  let availabilityMessage = 'A változtatások azonnal megjelennek a játékban és az eseménynaplóban.';
  if (gameState.winner || gameState.phase === 'game_over') {
    availabilityMessage = 'A játék véget ért. A tesztműveletekhez indíts új játékot.';
  } else if (gameState.phase === 'setup' || !activePlayer) {
    availabilityMessage = 'A játék indítása után használhatod a tesztműveleteket. A hangokat már most kipróbálhatod.';
  } else if (gameState.isRolling || gameState.phase === 'moving') {
    availabilityMessage = 'A dobás vagy a lépés folyamatban van. Várd meg a végét.';
  } else if (!canUseGameActions) {
    availabilityMessage = 'Előbb zárd le az aktuális játékeseményt vagy ablakot. A panel dobás előtt és építkezéskor használható.';
  } else if (commandBusy) {
    availabilityMessage = 'A tesztművelet alkalmazása folyamatban van…';
  }

  // Lock synchronously as well as visually so two quick clicks cannot open competing events.
  const applyCommand = (command: () => void) => {
    if (!canUseGameActions || commandLock.current) return;
    commandLock.current = true;
    setCommandBusy(true);
    try {
      command();
    } finally {
      unlockTimer.current = setTimeout(() => {
        commandLock.current = false;
        setCommandBusy(false);
        unlockTimer.current = null;
      }, 200);
    }
  };

  return (
    <details className="dev-panel">
      <summary className="dev-panel__summary">
        <span className="dev-panel__summary-copy">
          <span className="dev-panel__eyebrow">DEMO · DEVTOOLS</span>
          <span className="dev-panel__title">Zsűri tesztpanel</span>
          <span className="dev-panel__subtitle">Gyors játékhelyzetek és hangeffektek</span>
        </span>
        <span className="dev-panel__toggle-hint" aria-hidden="true">Megnyitás / bezárás</span>
      </summary>

      <div className="dev-panel__body">
        <p id={`${panelId}-availability`} className="dev-panel__notice" role="status">
          {availabilityMessage}
        </p>

        <fieldset
          className="dev-panel__fieldset"
          disabled={!canUseGameActions || commandBusy}
          aria-describedby={`${panelId}-availability`}
        >
          <legend>Játékhelyzetek tesztelése</legend>

          <div className="dev-panel__player-picker">
            <label htmlFor={`${panelId}-player`}>Játékos a pénz- és helyzetmódosításhoz</label>
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
                : 'Az indításkor létrehozott játékosok itt jelennek meg.'}
            </p>
          </div>

          <div className="dev-panel__grid">
            <section className="dev-panel__card" aria-labelledby={`${panelId}-cash-title`}>
              <h3 id={`${panelId}-cash-title`}>Egyenleg módosítása</h3>
              <p>Egymillió KlinikaKredit hozzáadása vagy levonása a kiválasztott játékostól.</p>
              <div className="dev-panel__button-row">
                <button
                  className="dev-panel__button dev-panel__button--positive"
                  type="button"
                  disabled={!selectedPlayer}
                  onClick={() => selectedPlayer && applyCommand(() => onAdjustCash(selectedPlayer.id, CASH_STEP))}
                >
                  +1 000 000 KK
                </button>
                <button
                  className="dev-panel__button"
                  type="button"
                  disabled={!selectedPlayer || selectedPlayer.cash < CASH_STEP}
                  onClick={() => selectedPlayer && applyCommand(() => onAdjustCash(selectedPlayer.id, -CASH_STEP))}
                  aria-describedby={`${panelId}-cash-help`}
                >
                  −1 000 000 KK
                </button>
              </div>
              <p id={`${panelId}-cash-help`} className="dev-panel__help">A levonáshoz legalább 1 000 000 KK egyenleg szükséges.</p>
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
                onClick={() => selectedPlayer && applyCommand(() => onTeleport(selectedPlayer.id, selectedTileId))}
                aria-describedby={`${panelId}-teleport-help`}
              >
                Bábu áthelyezése
              </button>
              <p id={`${panelId}-teleport-help`} className="dev-panel__help">Csak a bábu helye változik. Az ugrás nem ad START-bónuszt, és nem indít mezőhatást.</p>
            </section>

            <section className="dev-panel__card" aria-labelledby={`${panelId}-card-title`}>
              <h3 id={`${panelId}-card-title`}>Konkrét eseménykártya</h3>
              <p>A kártyát a soron lévő játékos kapja: <strong>{activePlayer?.name ?? '—'}</strong>.</p>
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
              <button className="dev-panel__button" type="button" onClick={() => applyCommand(() => onDrawCard(selectedCardId))}>
                Kártya megnyitása
              </button>
              <p className="dev-panel__help">A hatást a megjelenő kártya elfogadásával alkalmazhatod.</p>
            </section>

            <section className="dev-panel__card dev-panel__card--victory" aria-labelledby={`${panelId}-victory-title`}>
              <h3 id={`${panelId}-victory-title`}>Azonnali győzelem</h3>
              <p>A soron lévő játékos győzelmét mutatja be: <strong>{activePlayer?.name ?? '—'}</strong>.</p>
              <p className="dev-panel__help">Felépíti a 8 részleget, rendezi a tartozást, és biztosítja a szükséges tartaléktőkét.</p>
              <button className="dev-panel__button dev-panel__button--victory" type="button" onClick={() => applyCommand(onInstantVictory)}>
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
            <span>Hangeffektek bekapcsolva</span>
            <span className="dev-panel__sound-state" aria-hidden="true">{soundEnabled ? 'BE' : 'KI'}</span>
          </label>
          <p id={`${panelId}-sound-help`} className="dev-panel__help">
            {soundEnabled ? 'Válassz egy hangot az előnézethez.' : 'Kapcsold be a hangeffekteket az előnézethez.'}
          </p>
          <div className="dev-panel__sound-grid">
            {SOUND_PREVIEWS.map((effect) => (
              <button
                key={effect.id}
                className="dev-panel__button dev-panel__sound-button"
                type="button"
                disabled={!soundEnabled}
                onClick={() => onPreviewSound(effect.id)}
                aria-label={`${effect.label} hangjának lejátszása`}
                aria-describedby={`${panelId}-sound-help`}
              >
                <span>{effect.label}</span>
                <span className="dev-panel__help">{effect.hint}</span>
              </button>
            ))}
          </div>
        </fieldset>

        <p className="dev-panel__log" aria-live="polite" aria-atomic="true">
          <span>Legutóbbi esemény</span>
          {gameState.logs[0]?.message ?? 'A játék eseményei itt követhetők.'}
        </p>
      </div>
    </details>
  );
}

export default DevPanel;
