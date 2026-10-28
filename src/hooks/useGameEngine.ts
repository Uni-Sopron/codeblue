import { useState, useCallback, useMemo } from 'react';
import type {
  GameState,
  Player,
  PlayerId,
  AvatarId,
  GamePhase,
  Card,
  ClinicElementId,
  GameLog,
  ActiveBuff,
  BankProduct,
} from '../types/game.ts';
import { GAME_CONSTANTS } from '../types/game.ts';
import { getTileById } from '../data/tiles.ts';
import { EVENT_CARDS } from '../data/cards.ts';
import { CLINIC_ELEMENTS, getClinicElementById } from '../data/clinicElements.ts';
import { AVATARS } from '../data/avatars.ts';
import { applyDevAction } from '../utils/devTools.ts';
import type { DevAction } from '../utils/devTools.ts';
import { accrueBankForMovement, applyBankTransaction, getBankBalances } from '../utils/bank.ts';
import type { BankAccrual, BankTransaction } from '../utils/bank.ts';

export interface PlayerSetupConfig {
  id: PlayerId;
  name: string;
  avatar: AvatarId;
  color?: string;
  isAI?: boolean;
}

/**
 * Fisher-Yates véletlenszerű keverő algoritmus a kártyapaklihoz
 */
function shuffleArray<T>(array: T[]): T[] {
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

/**
 * Egyedi naplóüzenet azonosító generálása
 */
function createLogId(): string {
  return `log_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}

function createBankReturnLog(accrual: BankAccrual): GameLog | null {
  const bank = getBankBalances(accrual.player);
  if (bank.savings === 0 && bank.clinicalBond === 0 && bank.biotechEquity === 0) return null;
  const formatReturn = (amount: number) => `${amount >= 0 ? '+' : ''}${amount.toLocaleString('hu-HU')} KK`;
  return {
    id: createLogId(),
    playerId: accrual.player.id,
    playerName: accrual.player.name,
    timestamp: Date.now(),
    type: 'money',
    message: `START banki elszámolás: megtakarítás ${formatReturn(accrual.returns.savings)}, `
      + `klinikai kötvény ${formatReturn(accrual.returns.clinicalBond)}, `
      + `biotech részvény ${formatReturn(accrual.returns.biotechEquity)}`
      + (accrual.biotechRate === null ? '.' : ` (${Math.round(accrual.biotechRate * 100)}%).`),
  };
}

/**
 * Kezdeti üres játékállapot
 */
const initialDeck = shuffleArray(EVENT_CARDS.map((c) => c.id));

const createInitialState = (): GameState => ({
  players: [],
  activePlayerIndex: 0,
  turnNumber: 1,
  phase: 'setup',
  diceResult: null,
  isRolling: false,
  drawnCard: null,
  cardDeck: initialDeck,
  discardDeck: [],
  winner: null,
  logs: [],
  roundPassBonusGranted: false,
  extraRollAvailable: false,
});

export function useGameEngine() {
  const [gameState, setGameState] = useState<GameState>(createInitialState);
  const [hasRolledThisTurn, setHasRolledThisTurn] = useState<boolean>(false);
  const [hasBuiltThisTurn, setHasBuiltThisTurn] = useState<boolean>(false);
  const [extraRollAvailable, setExtraRollAvailable] = useState<boolean>(false);

  // Aktuális soron lévő játékos
  const activePlayer = useMemo<Player | null>(() => {
    if (gameState.players.length === 0) return null;
    return gameState.players[gameState.activePlayerIndex] ?? null;
  }, [gameState.players, gameState.activePlayerIndex]);

  /**
   * Rendszernapló bejegyzés hozzáadása
   */
  const addLog = useCallback(
    (
      message: string,
      type: GameLog['type'] = 'system',
      playerId?: PlayerId,
      playerName?: string,
    ) => {
      setGameState((prev) => ({
        ...prev,
        logs: [
          {
            id: createLogId(),
            playerId: playerId ?? (prev.players[prev.activePlayerIndex]?.id),
            playerName: playerName ?? (prev.players[prev.activePlayerIndex]?.name),
            message,
            timestamp: Date.now(),
            type,
          },
          ...prev.logs.slice(0, 99), // Legutóbbi 100 naplóbejegyzés megőrzése
        ],
      }));
    },
    [],
  );

  /**
   * Automatikus hitelfelvétel hiányzó kötelező kiadás esetén
   * A játékos nem akadhat el pénzhiány miatt!
   */
  const calculateAutoLoan = (currentCash: number, requiredAmount: number): { cashAfter: number; loanAmount: number } => {
    if (currentCash >= requiredAmount) {
      return { cashAfter: currentCash - requiredAmount, loanAmount: 0 };
    }
    const deficit = requiredAmount - currentCash;
    // Legkisebb szükséges LOAN_UNIT többszörös felvétele
    const units = Math.ceil(deficit / GAME_CONSTANTS.LOAN_UNIT);
    const loanAmount = units * GAME_CONSTANTS.LOAN_UNIT;
    const cashAfter = (currentCash + loanAmount) - requiredAmount;
    return { cashAfter, loanAmount };
  };

  /**
   * Győzelmi feltételek ellenőrzése
   * i. Mind a 8 kötelező részleg felépült
   * ii. Megvan a minimális tartaléktőke (pl. 1 000 000 KK)
   * iii. Tartozásmentes (0 KK hitel)
   */
  const checkVictoryConditions = useCallback((player: Player): boolean => {
    const hasAllElements = CLINIC_ELEMENTS.every((el) => player.builtElements.includes(el.id));
    const hasMinCash = player.cash >= GAME_CONSTANTS.VICTORY_MIN_CASH;
    const isDebtFree = player.debt === 0;

    return hasAllElements && hasMinCash && isDebtFree;
  }, []);

  /**
   * 1. Új játék indítása a kiválasztott játékosokkal
   */
  const startGame = useCallback(
    (configs: PlayerSetupConfig[]) => {
      if (configs.length < GAME_CONSTANTS.MIN_PLAYERS || configs.length > GAME_CONSTANTS.MAX_PLAYERS) {
        throw new Error(`A játékosok száma ${GAME_CONSTANTS.MIN_PLAYERS} és ${GAME_CONSTANTS.MAX_PLAYERS} között kell legyen!`);
      }

      const initialPlayers: Player[] = configs.map((cfg) => {
        const avatarInfo = AVATARS.find((a) => a.id === cfg.avatar) ?? AVATARS[0];
        return {
          id: cfg.id,
          name: cfg.name.trim() || avatarInfo.title,
          color: cfg.color || avatarInfo.color,
          avatar: cfg.avatar,
          avatarTitle: avatarInfo.role,
          cash: GAME_CONSTANTS.INITIAL_CASH,
          debt: 0,
          position: 0,
          builtElements: [],
          skipTurns: 0,
          activeBuffs: [],
          isAI: !!cfg.isAI,
          bank: getBankBalances(null),
        };
      });

      const newDeck = shuffleArray(EVENT_CARDS.map((c) => c.id));

      setGameState({
        players: initialPlayers,
        activePlayerIndex: 0,
        turnNumber: 1,
        phase: 'roll',
        diceResult: null,
        isRolling: false,
        drawnCard: null,
        cardDeck: newDeck,
        discardDeck: [],
        winner: null,
        logs: [
          {
            id: createLogId(),
            message: `Új játék indult ${initialPlayers.length} orvossal! Kezdőtőke: ${GAME_CONSTANTS.INITIAL_CASH.toLocaleString()} KK.`,
            timestamp: Date.now(),
            type: 'system',
          },
        ],
        roundPassBonusGranted: false,
      });

      setHasRolledThisTurn(false);
      setHasBuiltThisTurn(false);
      setExtraRollAvailable(false);
    },
    [],
  );

  /**
   * 2. Kockadobás és lépés vezérlése
   * - Csak a soron lévő játékos dobhat
   * - Egy körben csak 1 dobás (kivéve extra_roll esetén)
   * - START mező áthaladáskor +300 000 KK
   */
  const rollDice = useCallback(() => {
    if (!activePlayer) return;
    if (gameState.phase !== 'roll') return;
    if (gameState.isRolling || gameState.winner) return;
    const canRoll = !hasRolledThisTurn || extraRollAvailable || !!gameState.extraRollAvailable;
    if (!canRoll) return;

    // Kockadobás (1 - 6)
    const roll = Math.floor(Math.random() * 6) + 1;
    const bankRandom = Math.random();
    setGameState((prev) => ({ ...prev, isRolling: true }));

    // Rövid vizuális időzítés után léptetés
    setTimeout(() => {
      setGameState((prev) => {
        const currentP = prev.players[prev.activePlayerIndex];
        if (!currentP || prev.phase !== 'roll' || !prev.isRolling) return prev;

        const oldPos = currentP.position;
        const newRawPos = oldPos + roll;
        const passedStart = newRawPos >= GAME_CONSTANTS.TOTAL_TILES;
        const newPos = newRawPos % GAME_CONSTANTS.TOTAL_TILES;

        let bonusAdded = 0;
        let newCash = currentP.cash;

        // START áthaladás logikája
        if (passedStart) {
          const hasNoBonusBuff = currentP.activeBuffs.some((b) => b.type === 'no_start_bonus');
          if (!hasNoBonusBuff) {
            bonusAdded = GAME_CONSTANTS.START_PASS_BONUS;
            newCash += bonusAdded;
          }
        }

        const bankAccrual = accrueBankForMovement(currentP, roll, () => bankRandom);
        const updatedPlayer: Player = {
          ...bankAccrual.player,
          position: newPos,
          cash: newCash,
        };

        const updatedPlayers = [...prev.players];
        updatedPlayers[prev.activePlayerIndex] = updatedPlayer;

        const targetTile = getTileById(newPos);
        const tileName = targetTile ? targetTile.name : `Mező #${newPos}`;

        const newLogs: GameLog[] = [
          {
            id: createLogId(),
            playerId: currentP.id,
            playerName: currentP.name,
            message: `${currentP.name} dobott: ${roll}. Új pozíció: ${tileName}.`,
            timestamp: Date.now(),
            type: 'move',
          },
        ];

        if (bonusAdded > 0) {
          newLogs.push({
            id: createLogId(),
            playerId: currentP.id,
            playerName: currentP.name,
            message: `Körbefutás a START mezőn! Jóváírás: +${bonusAdded.toLocaleString()} KK.`,
            timestamp: Date.now(),
            type: 'money',
          });
        }

        if (passedStart) {
          const bankLog = createBankReturnLog(bankAccrual);
          if (bankLog) newLogs.push(bankLog);
        }

        return {
          ...prev,
          players: updatedPlayers,
          diceResult: roll,
          isRolling: false,
          phase: 'tile_action',
          roundPassBonusGranted: passedStart,
          extraRollAvailable: false,
          logs: [...newLogs, ...prev.logs],
        };
      });

      setHasRolledThisTurn(true);
      if (extraRollAvailable) {
        setExtraRollAvailable(false);
      }
    }, 400);
  }, [activePlayer, gameState.phase, gameState.isRolling, gameState.winner, gameState.extraRollAvailable, hasRolledThisTurn, extraRollAvailable]);

  /**
   * 3. Mező eseményének feldolgozása
   */
  const resolveTileAction = useCallback(() => {
    setGameState((prev) => {
      if (prev.phase !== 'tile_action' || prev.winner) return prev;
      const currentP = prev.players[prev.activePlayerIndex];
      if (!currentP) return prev;

      const tile = getTileById(currentP.position);
      if (!tile) {
        return { ...prev, phase: 'building' };
      }

      const updatedP = { ...currentP };
      const newLogs: GameLog[] = [];
      let nextPhase: GamePhase = 'building';
      let drawnCard: Card | null = null;
      let newDeck = [...prev.cardDeck];
      let newDiscard = [...prev.discardDeck];

      switch (tile.type) {
        case 'start': {
          // Ha közvetlenül a START-ra érkezett és az áthaladáskor még nem kapott bónuszt ebben a lépésben
          if (!prev.roundPassBonusGranted) {
            updatedP.cash += GAME_CONSTANTS.START_PASS_BONUS;
            newLogs.push({
              id: createLogId(),
              playerId: currentP.id,
              playerName: currentP.name,
              message: `Megérkezés a START mezőre! Fenntartási támogatás: +${GAME_CONSTANTS.START_PASS_BONUS.toLocaleString()} KK.`,
              timestamp: Date.now(),
              type: 'money',
            });
          }
          break;
        }

        case 'income': {
          const val = tile.value ?? 150_000;
          updatedP.cash += val;
          newLogs.push({
            id: createLogId(),
            playerId: currentP.id,
            playerName: currentP.name,
            message: `${tile.name}: Jóváírás +${val.toLocaleString()} KK.`,
            timestamp: Date.now(),
            type: 'money',
          });
          break;
        }

        case 'expense': {
          const val = tile.value ?? 100_000;
          // Mentesség ellenőrzése
          const penaltyImmunityIndex = updatedP.activeBuffs.findIndex((b) => b.type === 'penalty_immunity');
          if (penaltyImmunityIndex !== -1) {
            const updatedBuffs = [...updatedP.activeBuffs];
            updatedBuffs.splice(penaltyImmunityIndex, 1);
            updatedP.activeBuffs = updatedBuffs;
            newLogs.push({
              id: createLogId(),
              playerId: currentP.id,
              playerName: currentP.name,
              message: `Felelősségbiztosítási mentesség aktiválva! A ${val.toLocaleString()} KK kiadás elengedve.`,
              timestamp: Date.now(),
              type: 'money',
            });
          } else {
            const { cashAfter, loanAmount } = calculateAutoLoan(updatedP.cash, val);
            updatedP.cash = cashAfter;
            if (loanAmount > 0) {
              updatedP.debt += loanAmount;
              newLogs.push({
                id: createLogId(),
                playerId: currentP.id,
                playerName: currentP.name,
                message: `Pénzhiány miatt automatikus bankhitel felvétele: +${loanAmount.toLocaleString()} KK.`,
                timestamp: Date.now(),
                type: 'money',
              });
            }
            newLogs.push({
              id: createLogId(),
              playerId: currentP.id,
              playerName: currentP.name,
              message: `${tile.name}: Levonás -${val.toLocaleString()} KK.`,
              timestamp: Date.now(),
              type: 'money',
            });
          }
          break;
        }

        case 'card': {
          // Kártyahúzás logikája: ha elfogyott a 40 kártya, automatikusan újrakeverjük a discard paklit
          if (newDeck.length === 0) {
            newDeck = shuffleArray(newDiscard.length > 0 ? newDiscard : EVENT_CARDS.map((c) => c.id));
            newDiscard = [];
            newLogs.push({
              id: createLogId(),
              message: `Az eseménykártya pakli elfogyott, a felhasznált lapok újrakeverve!`,
              timestamp: Date.now(),
              type: 'system',
            });
          }

          const drawnCardId = newDeck.shift()!;
          newDiscard.push(drawnCardId);
          drawnCard = EVENT_CARDS.find((c) => c.id === drawnCardId) ?? null;
          nextPhase = 'card_modal';
          break;
        }

        case 'purchase': {
          // 15% beruházási kedvezmény buff hozzáadása a következő építésre
          const discountBuff: ActiveBuff = {
            id: `buff_${Date.now()}`,
            name: 'Beszállítói Tender Kedvezmény',
            description: '15% kedvezmény a legközelebbi építkezésre',
            type: 'building_discount',
            value: 15,
            remainingTurns: 2,
          };
          updatedP.activeBuffs = [...updatedP.activeBuffs, discountBuff];
          newLogs.push({
            id: createLogId(),
            playerId: currentP.id,
            playerName: currentP.name,
            message: `${tile.name}: 15% építkezési kedvezmény jóváírva a következő vásárlásodra!`,
            timestamp: Date.now(),
            type: 'build',
          });
          break;
        }

        case 'special': {
          switch (tile.specialAction) {
            case 'ambulance_speed':
              setExtraRollAvailable(true);
              setHasRolledThisTurn(false);
              nextPhase = 'roll';
              newLogs.push({
                id: createLogId(),
                playerId: currentP.id,
                playerName: currentP.name,
                message: `Szirénázó Rohammentő: Azonnali újabb dobási lehetőséget kaptál ebben a körben!`,
                timestamp: Date.now(),
                type: 'move',
              });
              break;

            case 'grant_fund': {
              const grant = 200_000;
              updatedP.cash += grant;
              newLogs.push({
                id: createLogId(),
                playerId: currentP.id,
                playerName: currentP.name,
                message: `Egészségügyi Pályázati Alap támogatás: +${grant.toLocaleString()} KK kutatási forrás!`,
                timestamp: Date.now(),
                type: 'money',
              });
              break;
            }

            case 'medical_conference': {
              const fee = 150_000;
              updatedP.cash += fee;
              newLogs.push({
                id: createLogId(),
                playerId: currentP.id,
                playerName: currentP.name,
                message: `Orvoskongresszus előadói tiszteletdíj: +${fee.toLocaleString()} KK.`,
                timestamp: Date.now(),
                type: 'money',
              });
              break;
            }

            case 'telemedicine': {
              const builtCount = updatedP.builtElements.length;
              const bonus = builtCount * 40_000;
              if (bonus > 0) {
                updatedP.cash += bonus;
                newLogs.push({
                  id: createLogId(),
                  playerId: currentP.id,
                  playerName: currentP.name,
                  message: `Telemedicina jogdíjak (${builtCount} megépült részleg után): +${bonus.toLocaleString()} KK.`,
                  timestamp: Date.now(),
                  type: 'money',
                });
              } else {
                newLogs.push({
                  id: createLogId(),
                  playerId: currentP.id,
                  playerName: currentP.name,
                  message: `Telemedicina hálózat: Még nincs megépült részleged a jogdíjak folyósításához.`,
                  timestamp: Date.now(),
                  type: 'system',
                });
              }
              break;
            }

            case 'emergency_duty': {
              const dutyBonus = 120_000;
              updatedP.cash += dutyBonus;
              newLogs.push({
                id: createLogId(),
                playerId: currentP.id,
                playerName: currentP.name,
                message: `Sürgősségi Készenléti Ügyelet pótlék: +${dutyBonus.toLocaleString()} KK.`,
                timestamp: Date.now(),
                type: 'money',
              });
              break;
            }

            case 'disaster_readiness': {
              if (updatedP.debt === 0) {
                const bonus = 100_000;
                updatedP.cash += bonus;
                newLogs.push({
                  id: createLogId(),
                  playerId: currentP.id,
                  playerName: currentP.name,
                  message: `Klinikai Audit & Akkreditáció: Kiváló pénzügyi helyzet (0 KK adósság)! Bónusz: +${bonus.toLocaleString()} KK.`,
                  timestamp: Date.now(),
                  type: 'money',
                });
              } else {
                newLogs.push({
                  id: createLogId(),
                  playerId: currentP.id,
                  playerName: currentP.name,
                  message: `Klinikai Audit: Fennálló banki tartozás miatt nem vagy jogosult a minőségi bónuszra.`,
                  timestamp: Date.now(),
                  type: 'system',
                });
              }
              break;
            }
          }
          break;
        }

        case 'neutral':
        default:
          newLogs.push({
            id: createLogId(),
            playerId: currentP.id,
            playerName: currentP.name,
            message: `${tile.name}: Nyugodt kör, nincs kötelező kiadás.`,
            timestamp: Date.now(),
            type: 'system',
          });
          break;
      }

      const updatedPlayers = [...prev.players];
      updatedPlayers[prev.activePlayerIndex] = updatedP;

      return {
        ...prev,
        players: updatedPlayers,
        phase: nextPhase,
        drawnCard,
        cardDeck: newDeck,
        discardDeck: newDiscard,
        extraRollAvailable: tile.type === 'special' && tile.specialAction === 'ambulance_speed',
        logs: [...newLogs, ...prev.logs],
      };
    });
  }, []);

  /**
   * 4. Eseménykártya hatásának érvényesítése
   */
  const resolveCardAction = useCallback(() => {
    // A StrictMode-ban megismételt állapotfrissítő ugyanazt a piaci mintát használja.
    const bankRandom = Math.random();
    setGameState((prev) => {
      if (prev.phase !== 'card_modal' || prev.winner) return prev;
      const currentP = prev.players[prev.activePlayerIndex];
      const card = prev.drawnCard;
      if (!currentP || !card) return { ...prev, phase: 'building', drawnCard: null };

      const updatedP = { ...currentP };
      const newLogs: GameLog[] = [];
      const action = card.action;
      let startBonusSettled = prev.roundPassBonusGranted;

      newLogs.push({
        id: createLogId(),
        playerId: currentP.id,
        playerName: currentP.name,
        message: `Kártya aktiválva: [${card.title}] - ${card.description}`,
        timestamp: Date.now(),
        type: 'card',
      });

      switch (action.type) {
        case 'cash_reward': {
          const amt = action.amount ?? 200_000;
          updatedP.cash += amt;
          break;
        }

        case 'cash_penalty': {
          const amt = action.amount ?? 150_000;
          const { cashAfter, loanAmount } = calculateAutoLoan(updatedP.cash, amt);
          updatedP.cash = cashAfter;
          if (loanAmount > 0) {
            updatedP.debt += loanAmount;
            newLogs.push({
              id: createLogId(),
              playerId: currentP.id,
              playerName: currentP.name,
              message: `Pénzhiány miatt automatikus hitelfelvétel: +${loanAmount.toLocaleString()} KK.`,
              timestamp: Date.now(),
              type: 'money',
            });
          }
          break;
        }

        case 'extra_roll': {
          setExtraRollAvailable(true);
          setHasRolledThisTurn(false);
          newLogs.push({
            id: createLogId(),
            playerId: currentP.id,
            playerName: currentP.name,
            message: `${currentP.name} extra dobási lehetőséget nyert!`,
            timestamp: Date.now(),
            type: 'move',
          });
          break;
        }

        case 'skip_turn': {
          updatedP.skipTurns += 1;
          newLogs.push({
            id: createLogId(),
            playerId: currentP.id,
            playerName: currentP.name,
            message: `${currentP.name} a következő körből kimarad!`,
            timestamp: Date.now(),
            type: 'system',
          });
          break;
        }

        case 'move_relative': {
          const steps = action.steps ?? 0;
          const oldPos = updatedP.position;
          let newPos = oldPos + steps;

          // Körbefutás előre vagy hátra
          if (newPos >= GAME_CONSTANTS.TOTAL_TILES) {
            const accrual = accrueBankForMovement(updatedP, steps, () => bankRandom);
            updatedP.bank = accrual.player.bank;
            const bankLog = createBankReturnLog(accrual);
            if (bankLog) newLogs.push(bankLog);
            startBonusSettled = true;
            newPos = newPos % GAME_CONSTANTS.TOTAL_TILES;
            updatedP.cash += GAME_CONSTANTS.START_PASS_BONUS;
            newLogs.push({
              id: createLogId(),
              playerId: currentP.id,
              playerName: currentP.name,
              message: `START mezőn áthaladás! Jóváírás: +${GAME_CONSTANTS.START_PASS_BONUS.toLocaleString()} KK.`,
              timestamp: Date.now(),
              type: 'money',
            });
          } else if (newPos < 0) {
            newPos = (newPos + GAME_CONSTANTS.TOTAL_TILES) % GAME_CONSTANTS.TOTAL_TILES;
          }

          updatedP.position = newPos;
          newLogs.push({
            id: createLogId(),
            playerId: currentP.id,
            playerName: currentP.name,
            message: `${currentP.name} ${Math.abs(steps)} mezőt lépett ${steps > 0 ? 'előre' : 'hátra'}. Új mező: ${getTileById(newPos)?.name}`,
            timestamp: Date.now(),
            type: 'move',
          });
          break;
        }

        case 'move_absolute': {
          const target = action.targetTileId ?? 0;
          // A valódi START-kártya előre vezet a főbejárathoz; a zsűri teleportja nem kamatozik.
          if (target === 0 && updatedP.position > 0) {
            const accrual = accrueBankForMovement(
              updatedP,
              GAME_CONSTANTS.TOTAL_TILES - updatedP.position,
              () => bankRandom,
            );
            updatedP.bank = accrual.player.bank;
            const bankLog = createBankReturnLog(accrual);
            if (bankLog) newLogs.push(bankLog);
          }
          updatedP.position = target;
          if (action.amount) {
            updatedP.cash += action.amount;
            if (target === 0) startBonusSettled = true;
          }
          newLogs.push({
            id: createLogId(),
            playerId: currentP.id,
            playerName: currentP.name,
            message: `${currentP.name} a(z) ${getTileById(target)?.name} mezőre került!`,
            timestamp: Date.now(),
            type: 'move',
          });
          break;
        }

        case 'discount_building': {
          const pct = action.discountPercent ?? 25;
          const buff: ActiveBuff = {
            id: `buff_${Date.now()}`,
            name: `${pct}% Építkezési Támogatás`,
            description: `${pct}% kedvezmény a következő részleg megvásárlására`,
            type: 'building_discount',
            value: pct,
            remainingTurns: 2,
          };
          updatedP.activeBuffs = [...updatedP.activeBuffs, buff];
          break;
        }

        case 'free_building': {
          const targetElem = action.targetElementId ?? 'reception';
          if (!updatedP.builtElements.includes(targetElem)) {
            updatedP.builtElements = [...updatedP.builtElements, targetElem];
            newLogs.push({
              id: createLogId(),
              playerId: currentP.id,
              playerName: currentP.name,
              message: `Sikeres adomány: ${getClinicElementById(targetElem)?.name} ingyen felépült!`,
              timestamp: Date.now(),
              type: 'build',
            });
          } else if (action.amount) {
            updatedP.cash += action.amount;
            newLogs.push({
              id: createLogId(),
              playerId: currentP.id,
              playerName: currentP.name,
              message: `A részleg már megépült, helyette +${action.amount.toLocaleString()} KK kárpótlás jár.`,
              timestamp: Date.now(),
              type: 'money',
            });
          }
          break;
        }

        case 'tax_percentage': {
          const pct = (action.amount ?? 10) / 100;
          const taxAmt = Math.round(updatedP.cash * pct);
          updatedP.cash -= taxAmt;
          newLogs.push({
            id: createLogId(),
            playerId: currentP.id,
            playerName: currentP.name,
            message: `Különadó befizetve: -${taxAmt.toLocaleString()} KK (${action.amount}%).`,
            timestamp: Date.now(),
            type: 'money',
          });
          break;
        }

        default:
          break;
      }

      const updatedPlayers = [...prev.players];
      updatedPlayers[prev.activePlayerIndex] = updatedP;

      return {
        ...prev,
        players: updatedPlayers,
        phase: action.type === 'extra_roll' || extraRollAvailable ? 'roll' : 'building',
        extraRollAvailable: action.type === 'extra_roll',
        drawnCard: null,
        roundPassBonusGranted: startBonusSettled,
        logs: [...newLogs, ...prev.logs],
      };
    });
  }, [extraRollAvailable]);

  /**
   * 5. Építési jogosultság ellenőrzése a felület számára
   */
  const canBuyElement = useCallback(
    (elementId: ClinicElementId): { canBuy: boolean; reason?: string; finalCost: number } => {
      if (!activePlayer) return { canBuy: false, reason: 'Nincs aktív játékos', finalCost: 0 };
      if (hasBuiltThisTurn) return { canBuy: false, reason: 'Körönként legfeljebb 1 részleg építhető!', finalCost: 0 };

      const elem = getClinicElementById(elementId);
      if (!elem) return { canBuy: false, reason: 'Ismeretlen épület', finalCost: 0 };

      if (activePlayer.builtElements.includes(elementId)) {
        return { canBuy: false, reason: 'Már felépült!', finalCost: elem.cost };
      }

      if (elem.prerequisiteId && !activePlayer.builtElements.includes(elem.prerequisiteId)) {
        const prereq = getClinicElementById(elem.prerequisiteId);
        return {
          canBuy: false,
          reason: `Előfeltétel hiányzik: ${prereq ? prereq.name : elem.prerequisiteId}`,
          finalCost: elem.cost,
        };
      }

      // Kedvezmények kiszámítása
      const discountBuff = activePlayer.activeBuffs.find((b) => b.type === 'building_discount');
      const discountPercent = discountBuff?.value ?? 0;
      const finalCost = Math.round(elem.cost * (1 - discountPercent / 100));

      if (activePlayer.cash < finalCost) {
        return {
          canBuy: false,
          reason: `Nincs elegendő fedezet (szükséges: ${finalCost.toLocaleString()} KK)`,
          finalCost,
        };
      }

      return { canBuy: true, finalCost };
    },
    [activePlayer, hasBuiltThisTurn],
  );

  /**
   * 6. Klinikarészleg megvásárlása
   */
  const buyClinicElement = useCallback(
    (elementId: ClinicElementId) => {
      const check = canBuyElement(elementId);
      if (!check.canBuy) {
        addLog(`Sikertelen építkezési kísérlet: ${check.reason}`, 'build');
        return false;
      }

      setGameState((prev) => {
        const currentP = prev.players[prev.activePlayerIndex];
        if (!currentP) return prev;

        const elem = getClinicElementById(elementId)!;
        const remainingBuffs = currentP.activeBuffs.filter((b) => b.type !== 'building_discount');

        const updatedPlayer: Player = {
          ...currentP,
          cash: currentP.cash - check.finalCost,
          builtElements: [...currentP.builtElements, elementId],
          activeBuffs: remainingBuffs,
        };

        const updatedPlayers = [...prev.players];
        updatedPlayers[prev.activePlayerIndex] = updatedPlayer;

        const logMsg = `${currentP.name} sikeresen felépítette: ${elem.name}! Vételár: ${check.finalCost.toLocaleString()} KK. (${updatedPlayer.builtElements.length}/8 részleg kész)`;

        return {
          ...prev,
          players: updatedPlayers,
          logs: [
            {
              id: createLogId(),
              playerId: currentP.id,
              playerName: currentP.name,
              message: logMsg,
              timestamp: Date.now(),
              type: 'build',
            },
            ...prev.logs,
          ],
        };
      });

      setHasBuiltThisTurn(true);
      return true;
    },
    [canBuyElement, addLog],
  );

  /**
   * 7. Banki műveletek: Hitelfelvétel és hiteltörlesztés
   */
  const transactBank = useCallback((action: BankTransaction) => {
    const id = createLogId();
    const timestamp = Date.now();
    setGameState((prev) => {
      const next = applyBankTransaction(prev, action);
      if (next === prev) return prev;
      const before = prev.players[prev.activePlayerIndex];
      const player = next.players[next.activePlayerIndex];
      const labels = { savings: 'megtakarítás', clinicalBond: 'klinikai kötvény', biotechEquity: 'biotech részvény' };
      let message: string;
      if (action.type === 'deposit' || action.type === 'withdraw') {
        message = `${player.name}: ${labels[action.product]} ${action.type === 'deposit' ? 'elhelyezése' : 'visszaváltása'} `
          + `${action.amount.toLocaleString('hu-HU')} KK értékben.`;
      } else if (action.type === 'borrow') {
        message = `${player.name} banki hitelt vett fel: +${(player.cash - before.cash).toLocaleString('hu-HU')} KK. `
          + `Fennálló tartozás: ${player.debt.toLocaleString('hu-HU')} KK.`;
      } else {
        message = `${player.name} visszafizetett ${(before.debt - player.debt).toLocaleString('hu-HU')} KK hitelt. `
          + `Maradék hitel: ${player.debt.toLocaleString('hu-HU')} KK.`;
      }
      const log: GameLog = { id, timestamp, playerId: player.id, playerName: player.name, message, type: 'money' };
      return { ...next, logs: [log, ...prev.logs].slice(0, 100) };
    });
  }, []);

  const takeLoan = useCallback((amount: number) => {
    transactBank({ type: 'borrow', amount });
  }, [transactBank]);

  const repayLoan = useCallback((amount: number) => {
    transactBank({ type: 'repay', amount });
  }, [transactBank]);

  const depositBank = useCallback((product: BankProduct, amount: number) => {
    transactBank({ type: 'deposit', product, amount });
  }, [transactBank]);

  const withdrawBank = useCallback((product: BankProduct, amount: number) => {
    transactBank({ type: 'withdraw', product, amount });
  }, [transactBank]);

  /**
   * 8. Kör lezárása és játékosváltás
   * - Ellenőrzi a győzelmi feltételeket
   * - Kezeli a következő játékos körből kimaradását
   */
  const endTurn = useCallback(() => {
    setGameState((prev) => {
      const currentP = prev.players[prev.activePlayerIndex];
      if (!currentP) return prev;

      // Győzelmi feltételek ellenőrzése a kör végén
      if (checkVictoryConditions(currentP)) {
        return {
          ...prev,
          phase: 'game_over',
          winner: currentP,
          logs: [
            {
              id: createLogId(),
              playerId: currentP.id,
              playerName: currentP.name,
              message: `🏆 GYŐZELEM! ${currentP.name} teljesítette mind a 3 győzelmi feltételt: mind a 8 részleg felépült, van legalább ${GAME_CONSTANTS.VICTORY_MIN_CASH.toLocaleString()} KK tőkéje, és 0 KK adóssága van!`,
              timestamp: Date.now(),
              type: 'system',
            },
            ...prev.logs,
          ],
        };
      }

      // Következő játékos kiválasztása
      let nextIndex = (prev.activePlayerIndex + 1) % prev.players.length;
      let nextTurnNumber = prev.turnNumber;
      if (nextIndex === 0) {
        nextTurnNumber += 1;
      }

      const updatedPlayers = [...prev.players];
      let nextP = { ...updatedPlayers[nextIndex] };
      const skipLogs: GameLog[] = [];

      // Körből kimaradás ellenőrzése a következő játékosnál
      while (nextP.skipTurns > 0) {
        skipLogs.push({
          id: createLogId(),
          playerId: nextP.id,
          playerName: nextP.name,
          message: `${nextP.name} kimarad a(z) ${nextTurnNumber}. körből (fennmaradó büntetés: ${nextP.skipTurns - 1})!`,
          timestamp: Date.now(),
          type: 'system',
        });
        nextP.skipTurns -= 1;
        updatedPlayers[nextIndex] = nextP;

        // Továbbugrás a rákövetkező játékosra
        nextIndex = (nextIndex + 1) % prev.players.length;
        if (nextIndex === 0) {
          nextTurnNumber += 1;
        }
        nextP = { ...updatedPlayers[nextIndex] };
      }

      // Aktív buffok idejének frissítése
      const refreshedBuffs = nextP.activeBuffs
        .map((b) => ({ ...b, remainingTurns: b.remainingTurns - 1 }))
        .filter((b) => b.remainingTurns > 0);
      nextP.activeBuffs = refreshedBuffs;
      updatedPlayers[nextIndex] = nextP;

      return {
        ...prev,
        players: updatedPlayers,
        activePlayerIndex: nextIndex,
        turnNumber: nextTurnNumber,
        phase: 'roll',
        diceResult: null,
        drawnCard: null,
        roundPassBonusGranted: false,
        logs: [...skipLogs, ...prev.logs],
      };
    });

    setHasRolledThisTurn(false);
    setHasBuiltThisTurn(false);
    setExtraRollAvailable(false);
  }, [checkVictoryConditions]);

  /**
   * 9. Játék újraindítása
   */
  const resetGame = useCallback(() => {
    setGameState(createInitialState());
    setHasRolledThisTurn(false);
    setHasBuiltThisTurn(false);
    setExtraRollAvailable(false);
  }, []);

  /**
   * 9.1 Meccs újraindítása helyben a táblán (orvosok megtartásával, főmenübe lépés nélkül)
   */
  const restartCurrentMatch = useCallback(() => {
    setGameState((prev) => {
      const freshPlayers = prev.players.map((p) => ({
        ...p,
        cash: 1500000,
        debt: 0,
        position: 0,
        builtElements: [],
        skipTurns: 0,
        activeBuffs: [],
      }));
      return {
        ...prev,
        players: freshPlayers,
        activePlayerIndex: 0,
        turnNumber: 1,
        phase: 'roll',
        diceResult: null,
        isRolling: false,
        drawnCard: null,
        cardDeck: shuffleArray(EVENT_CARDS.map((c) => c.id)),
        discardDeck: [],
        winner: null,
        roundPassBonusGranted: false,
        logs: [
          ...prev.logs,
          {
            id: `log-${Date.now()}`,
            timestamp: Date.now(),
            message: '🔄 Új mérkőzés indult a táblán a kiválasztott orvosokkal!',
            type: 'system',
          },
        ],
      };
    });
    setHasRolledThisTurn(false);
    setHasBuiltThisTurn(false);
    setExtraRollAvailable(false);
  }, []);

  // Explicit debug API keeps the panel on the same state as the real game.
  const dispatchDevAction = useCallback((action: DevAction) => {
    setGameState((prev) => applyDevAction(prev, action));
  }, []);

  const devAdjustCash = useCallback((playerId: PlayerId, amount: number) => {
    dispatchDevAction({ type: 'adjust_cash', playerId, amount });
  }, [dispatchDevAction]);

  const devTeleport = useCallback((playerId: PlayerId, tileId: number) => {
    dispatchDevAction({ type: 'teleport', playerId, tileId });
  }, [dispatchDevAction]);

  const devDrawCard = useCallback((cardId: number) => {
    dispatchDevAction({ type: 'draw_card', cardId });
  }, [dispatchDevAction]);

  const devInstantVictory = useCallback(() => {
    dispatchDevAction({ type: 'instant_victory' });
  }, [dispatchDevAction]);

  const setFullGameState = useCallback((newStateOrUpdater: GameState | ((prev: GameState) => GameState)) => {
    setGameState((prev) => {
      const resolved = typeof newStateOrUpdater === 'function' ? newStateOrUpdater(prev) : newStateOrUpdater;
      const normalizedState: GameState = {
        ...resolved,
        players: resolved.players.map((player) => ({ ...player, bank: getBankBalances(player) })),
        winner: resolved.winner ? { ...resolved.winner, bank: getBankBalances(resolved.winner) } : null,
      };
      if (normalizedState.phase === 'roll') {
        setHasRolledThisTurn(false);
        setHasBuiltThisTurn(false);
        setExtraRollAvailable(!!normalizedState.extraRollAvailable);
      } else if (normalizedState.phase === 'building' || normalizedState.phase === 'tile_action') {
        setHasRolledThisTurn(true);
      }
      return normalizedState;
    });
  }, []);

  return {
    gameState,
    activePlayer,
    hasRolledThisTurn,
    hasBuiltThisTurn,
    extraRollAvailable,
    startGame,
    rollDice,
    resolveTileAction,
    resolveCardAction,
    buyClinicElement,
    canBuyElement,
    takeLoan,
    repayLoan,
    depositBank,
    withdrawBank,
    endTurn,
    restartCurrentMatch,
    resetGame,
    setFullGameState,
    devAdjustCash,
    devTeleport,
    devDrawCard,
    devInstantVictory,
  };
}
