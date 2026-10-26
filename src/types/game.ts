/**
 * CodeBlue - Magánklinika Társasjáték
 * Core Domain Types and Interfaces (Issue #1)
 */

// ==========================================
// 1. Játékosok és Karakterek (Players & Avatars)
// ==========================================

export type PlayerId = 'p1' | 'p2' | 'p3' | 'p4';

export type AvatarId = 'surgeon' | 'diagnostician' | 'chief_physician' | 'resident';

export interface AvatarInfo {
  id: AvatarId;
  title: string;       // pl. "Dr. Sebész"
  role: string;        // pl. "Vezető Sebészorvos"
  color: string;       // HEX színkód
  accentColor: string; // Halványabb háttérszín
  icon: string;        // Ikon azonosító
  description: string;
}

export interface ActiveBuff {
  id: string;
  name: string;
  description: string;
  type: 
    | 'building_discount'   // Százalékos vagy fix kedvezmény építéskor
    | 'penalty_immunity'    // Következő bírság vagy kiadás alóli mentesség
    | 'extra_roll'          // Következő körben még egy dobás
    | 'no_start_bonus';     // START áthaladási bónusz megvonása
  value?: number;
  remainingTurns: number;
}

export interface Player {
  id: PlayerId;
  name: string;
  color: string;
  avatar: AvatarId;
  avatarTitle: string;
  cash: number;           // Egyenleg (KlinikaKredit - KK)
  debt: number;           // Fennálló banki tartozás / hitel (KK)
  position: number;       // Aktuális mező indexe (0 - 35)
  builtElements: string[];// Megvásárolt klinikai részlegek azonosítói (ClinicElementId)
  skipTurns: number;      // Körből kimaradás büntetés számláló
  activeBuffs: ActiveBuff[];
  isAI?: boolean;
}

// ==========================================
// 2. Játéktábla és Mezők (Board & Tiles)
// ==========================================

export type TileType = 
  | 'start'     // START mező (áthaladás és megállás jutalma)
  | 'income'    // Bevételi mező
  | 'expense'   // Kiadási mező
  | 'card'      // Eseménykártya húzó mező
  | 'purchase'  // Vásárlási előnyt nyújtó mező
  | 'neutral'   // Semleges mező (pihenő, audit)
  | 'special';  // Egyedi speciális játékszabályt indító mező

export type SpecialActionType = 
  | 'ambulance_speed'      // Rohammentő: azonnali extra lépés vagy újra dobás
  | 'medical_conference'   // Orvoskongresszus: publikációs bónusz vagy részvételi díj
  | 'grant_fund'           // Kutatási pályázati alap: kockázat / jutalom sorsolás
  | 'emergency_duty'       // Sürgősségi készenlét
  | 'telemedicine'         // Birtokolt részlegek után járó digitális prémium
  | 'disaster_readiness';  // Állami katasztrófavédelmi szolidaritási alap

export interface Tile {
  id: number;              // 0 - 35
  name: string;            // Mező neve (pl. "Magánrendelés Bevétele")
  type: TileType;
  value?: number;          // Fix összeg (KK), ha van
  description: string;     // Érkezéskor megjelenő leírás
  icon: string;            // Ikon neve (Lucide / SVG)
  specialAction?: SpecialActionType;
}

// ==========================================
// 3. Eseménykártyák (Event Cards - 40 db)
// ==========================================

export type CardCategory = 
  | 'income'        // 12 db Nyeremény, bevétel
  | 'expense'       // 12 db Veszteség, kiadás
  | 'advantage'     // 8 db Előny
  | 'disadvantage'; // 8 db Hátrány

export type CardActionType = 
  | 'cash_reward'       // Pénz jóváírás
  | 'cash_penalty'      // Pénz levonás (bírság, kár)
  | 'extra_roll'        // Azonnali extra dobás
  | 'skip_turn'         // Körből kimaradás
  | 'move_relative'     // Lépés előre vagy hátra X mezőt
  | 'move_absolute'     // Ugrás adott mezőre (pl. START vagy legközelebbi kávézó)
  | 'discount_building' // Kedvezmény a következő épületre
  | 'free_building'     // Ingyenesen felépülő részleg
  | 'tax_percentage'    // Vagyonarányos befizetés
  | 'custom';

export interface CardAction {
  type: CardActionType;
  amount?: number;
  steps?: number;
  targetTileId?: number;
  targetElementId?: ClinicElementId;
  discountPercent?: number;
}

export interface Card {
  id: number;              // 1 - 40
  category: CardCategory;
  title: string;           // Kártya címe (pl. "Állami Kutatási Támogatás")
  description: string;     // Játékosnak szóló leírás és instrukció
  flavorText?: string;     // Történeti hangulati elem
  action: CardAction;
}

// ==========================================
// 4. Magánklinika Részlegek (Clinic Wings - 8 db)
// ==========================================

export type ClinicElementId = 
  | 'reception'    // 1. Recepció és Váróterem
  | 'lab'          // 2. Orvosi Laboratórium
  | 'diagnostics'  // 3. Diagnosztikai Központ (MRI & UH)
  | 'surgery'      // 4. Korszerű Műtő
  | 'vip_ward'     // 5. VIP Kórterem
  | 'icu'          // 6. Intenzív Terápiás Osztály
  | 'rehab'        // 7. Rehabilitációs Park
  | 'helipad';     // 8. Mentőállomás és Helipad

export interface ClinicElement {
  id: ClinicElementId;
  name: string;                    // Részleg neve
  cost: number;                    // Vételár (KK)
  prerequisiteId?: ClinicElementId;// Előfeltétel elem azonosítója
  description: string;             // Funkció és szerep a klinikán
  icon: string;                    // Megjelenítendő ikon
  order: number;                   // Sorrend a tervrajzon (1 - 8)
}

// ==========================================
// 5. Játékállapot és Körök (Game State & Phases)
// ==========================================

export type GamePhase = 
  | 'setup'         // Kezdőképernyő: játékosok száma, nevek, bábuk kiválasztása
  | 'roll'          // Kockadobásra vár
  | 'moving'        // Bábu lépés animáció
  | 'tile_action'   // Mező eseményének feldolgozása
  | 'card_modal'    // Eseménykártya felugró ablak
  | 'bank_modal'    // Pénzhiány / hitel ablak
  | 'building'      // Építkezési lehetőség a kör végén
  | 'turn_end'      // Kör lezárása, következő játékosra váltás
  | 'game_over';    // Győzelem kihirdetése

export interface GameLog {
  id: string;
  playerId?: PlayerId;
  playerName?: string;
  message: string;
  timestamp: number;
  type: 'move' | 'money' | 'card' | 'build' | 'system';
}

export interface GameState {
  players: Player[];
  activePlayerIndex: number;
  turnNumber: number;
  phase: GamePhase;
  diceResult: number | null;
  isRolling: boolean;
  drawnCard: Card | null;
  cardDeck: number[];              // Még rendelkezésre álló kártya azonosítók (1-40)
  discardDeck: number[];           // Felhasznált lapok
  winner: Player | null;
  logs: GameLog[];
  roundPassBonusGranted: boolean;  // START mező áthaladás egyszeri regisztrációja a lépésben
}

// ==========================================
// 6. Gazdasági és Szabály Konstansok (Constants)
// ==========================================

export const GAME_CONSTANTS = {
  MIN_PLAYERS: 2,
  MAX_PLAYERS: 4,
  TOTAL_TILES: 36,
  TOTAL_CARDS: 40,
  TOTAL_CLINIC_ELEMENTS: 8,
  START_PASS_BONUS: 300_000,       // START áthaladás jutalma (KK)
  INITIAL_CASH: 1_500_000,         // Kezdőtőke (az építési összköltség ~25%-a)
  VICTORY_MIN_CASH: 1_000_000,     // Győzelemhez szükséges minimális tartaléktőke (KK)
  LOAN_UNIT: 200_000,              // Minimális hitelfelvételi egység
  LOAN_INTEREST_RATE: 0.10,        // 10% visszafizetési kamat
} as const;
