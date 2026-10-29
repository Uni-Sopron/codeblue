import type { Tile } from '../types/game.ts';

/**
 * A játéktábla 36 mezőből álló zárt pályája (0 - 35)
 * Elfogadási feltételek szerint:
 * - 1 db START mező (+300 000 KK áthaladáskor vagy megálláskor)
 * - 6 db card kártyahúzó mező (javasolt 6 db)
 * - income és expense mezők kiegyensúlyozott összegekkel
 * - purchase mezők (vásárlási akciók)
 * - neutral mezők (pihenő, audit)
 * - Egyedi speciális mezők (pl. Szirénázó Rohammentő, Orvoskongresszus, Egészségügyi Pályázati Alap)
 */
export const BOARD_TILES: Tile[] = [
  // --- 1. OLDAL (0 - 8) ---
  {
    id: 0,
    name: 'START - Klinika Főbejárat',
    type: 'start',
    value: 300_000,
    icon: 'Flag',
    description: 'Áthaladáskor vagy rálépéskor 300 000 KK fenntartási támogatás kerül jóváírásra.',
  },
  {
    id: 1,
    name: 'Páciens Koordinációs Iroda',
    type: 'neutral',
    icon: 'Coffee',
    description: 'Békés konzultáció az ügyfélszolgálaton. Nincs kötelező fizetési vagy játékesemény.',
  },
  {
    id: 2,
    name: 'Klinikai Hírek & Események',
    type: 'card',
    icon: 'MailOpen',
    description: 'Húzz egy véletlenszerű eseménykártyát és hajtsd végre az utasításait!',
  },
  {
    id: 3,
    name: 'Magánrendelés Bevétele',
    type: 'income',
    value: 150_000,
    icon: 'TrendingUp',
    description: 'A sikeres szakorvosi rendelések után 150 000 KK bevétel folyik be a számládra.',
  },
  {
    id: 4,
    name: 'Szirénázó Rohammentő',
    type: 'special',
    specialAction: 'ambulance_speed',
    icon: 'Zap',
    description: 'Sürgősségi hívás futott be szirénázó rohamkocsival! Azonnali újabb dobást kapsz.',
  },
  {
    id: 5,
    name: 'Műszerkarbantartási Számla',
    type: 'expense',
    value: 120_000,
    icon: 'Wrench',
    description: 'Kötelező periodikus kalibráció és szerviz a laborban. Folyósíts 120 000 KK szervizdíjat!',
  },
  {
    id: 6,
    name: 'Orvostechnikai Tender & Akció',
    type: 'purchase',
    icon: 'Tag',
    description: 'Nagykereskedelmi partneri tender! A következő építkezésedre 15% árengedményt kapsz.',
  },
  {
    id: 7,
    name: 'Egészségügyi Közlöny',
    type: 'card',
    icon: 'Newspaper',
    description: 'Váratlan rendelet vagy ágazati döntés! Húzz egy eseménykártyát!',
  },
  {
    id: 8,
    name: 'Egynapos Sebészeti Prémium',
    type: 'income',
    value: 200_000,
    icon: 'Banknote',
    description: 'Komplikációmentes esztétikai és egynapos beavatkozások bevétele. +200 000 KK tiszta haszon.',
  },

  // --- 2. OLDAL (9 - 17) ---
  {
    id: 9,
    name: 'Etikai Bizottság & Pihenőpark',
    type: 'neutral',
    icon: 'TreePine',
    description: 'Szakmai kamara ülése és pihenés a klinika zöldellő arborétumában. Eseménytelen kör.',
  },
  {
    id: 10,
    name: 'Veszélyeshulladék-elszállítás',
    type: 'expense',
    value: 90_000,
    icon: 'Trash2',
    description: 'Szigorú környezetvédelmi előírások szerinti megsemmisítés. Fizess 90 000 KK költséget!',
  },
  {
    id: 11,
    name: 'Klinikai Protokoll Értesítés',
    type: 'card',
    icon: 'FileText',
    description: 'Minőségbiztosítási határozat érkezett. Húzz egy eseménykártyát!',
  },
  {
    id: 12,
    name: 'VIP Biztosítói Térítés',
    type: 'income',
    value: 250_000,
    icon: 'ShieldCheck',
    description: 'Nemzetközi magánbiztosító jóváhagyott kártérítési tételei. Jóváírás: 250 000 KK.',
  },
  {
    id: 13,
    name: 'Egészségügyi Pályázati Alap',
    type: 'special',
    specialAction: 'grant_fund',
    icon: 'Sparkles',
    description: 'Kiemelt orvostudományi pályázat! Sikeres elbírálás esetén 200 000 KK kutatási forráshoz jutsz.',
  },
  {
    id: 14,
    name: 'Gyógyszergyári Partneri Támogatás',
    type: 'purchase',
    icon: 'ShoppingBag',
    description: 'Beszállítói együttműködés. Kedvezményes orvostechnikai épületfelszerelési opció.',
  },
  {
    id: 15,
    name: 'Tisztatéri Légtechnika Rezsi',
    type: 'expense',
    value: 140_000,
    icon: 'ZapOff',
    description: 'A HEPA-szűrős steril légtechnika magas energiaigénye. Fizesd be a 140 000 KK rezsiszámlát!',
  },
  {
    id: 16,
    name: 'Minőségbiztosítási Audit & Pihenő',
    type: 'neutral',
    icon: 'CheckSquare',
    description: 'Tervezett belső auditálás, minden szabályos. Folytathatod a játékot további kötelezettség nélkül.',
  },
  {
    id: 17,
    name: 'Szűrővizsgálati Csomagok',
    type: 'income',
    value: 180_000,
    icon: 'Users',
    description: 'Vállalati menedzserszűrések és prevenciós vizsgálatok bevétele. Jóváírás: 180 000 KK.',
  },

  // --- 3. OLDAL (18 - 26) ---
  {
    id: 18,
    name: 'Orvoskongresszus',
    type: 'special',
    specialAction: 'medical_conference',
    icon: 'Award',
    description: 'Kiemelt plenáris előadást tartasz a legújabb eljárásokról! Publikációs tiszteletdíj: 150 000 KK.',
  },
  {
    id: 19,
    name: 'Orvosi Pihenő és Látogatói Terem',
    type: 'neutral',
    icon: 'CupSoda',
    description: 'Egy kellemes kávészünet a kollégákkal a klinika panorámás teraszán. Pihenő kör.',
  },
  {
    id: 20,
    name: 'Klinikai Sorsjegy',
    type: 'card',
    icon: 'Sparkle',
    description: 'Váratlan szakmai vagy pénzügyi fordulat a klinika életében! Húzz egy eseménykártyát!',
  },
  {
    id: 21,
    name: 'Klinikai Gyógyszervizsgálat',
    type: 'income',
    value: 220_000,
    icon: 'Microscope',
    description: 'III. fázisú klinikai farmakológiai kutatás sikeres zárása. Kutatási honorárium: 220 000 KK.',
  },
  {
    id: 22,
    name: 'Telemedicina Hálózat',
    type: 'special',
    specialAction: 'telemedicine',
    icon: 'Radio',
    description: 'Digitális távkonzultáció: minden már megépült klinikai részleged után 40 000 KK jogdíj jár!',
  },
  {
    id: 23,
    name: 'Felelősségbiztosítási Díj',
    type: 'expense',
    value: 160_000,
    icon: 'ShieldAlert',
    description: 'Éves intézményi orvosi műhiba felelősségbiztosítási díj esedékes. Levonás: 160 000 KK.',
  },
  {
    id: 24,
    name: 'Klinikai Vásár & Expo',
    type: 'purchase',
    icon: 'BadgePercent',
    description: 'Orvostechnikai Expo akció! 20% árengedmény a következő részleg megvásárlásakor.',
  },
  {
    id: 25,
    name: 'Kamarai Hirdetmény',
    type: 'card',
    icon: 'Layers',
    description: 'Új egészségügyi szabályozás lépett életbe. Húzz egy eseménykártyát!',
  },
  {
    id: 26,
    name: 'Plasztikai Sebészeti Bónusz',
    type: 'income',
    value: 210_000,
    icon: 'Gem',
    description: 'Kiemelkedő kereslet a prémium plasztikai és lézeres kezelésekre. +210 000 KK adózott nyereség.',
  },

  // --- 4. OLDAL (27 - 35) ---
  {
    id: 27,
    name: 'Klinikai Audit & Akkreditáció',
    type: 'special',
    specialAction: 'disaster_readiness',
    icon: 'CheckCircle2',
    description: 'Szigorú nemzetközi minőségügyi átvilágítás. Ha nincs adósságod, 100 000 KK bónuszt kapsz!',
  },
  {
    id: 28,
    name: 'Szakorvosi Továbbképzési Költség',
    type: 'expense',
    value: 110_000,
    icon: 'GraduationCap',
    description: 'A rezidensek és szakorvosok nemzetközi akkreditációs képzésének tandíja. Fizess 110 000 KK-t!',
  },
  {
    id: 29,
    name: 'Sürgős Műszerlízing Törlesztő',
    type: 'expense',
    value: 150_000,
    icon: 'CreditCard',
    description: 'A high-tech orvosi képalkotó gépek havi lízingrészletének befizetése. Kiadás: 150 000 KK.',
  },
  {
    id: 30,
    name: 'Magzati Diagnosztika Díja',
    type: 'income',
    value: 170_000,
    icon: 'HeartHandshake',
    description: 'Speciális 4D ultrahang és genetikai szűrőcsomagok bevétele. +170 000 KK.',
  },
  {
    id: 31,
    name: 'Sürgősségi Készenléti Ügyelet',
    type: 'special',
    specialAction: 'emergency_duty',
    icon: 'Siren',
    description: 'Kiemelt éjszakai készenléti ügyelet. 120 000 KK ügyeleti pótlékban részesülsz.',
  },
  {
    id: 32,
    name: 'Műszerlízing Kedvezmény',
    type: 'purchase',
    icon: 'Stethoscope',
    description: 'Lízingcég támogatási akciója: 100 000 KK közvetlen árengedmény a következő beruházásra.',
  },
  {
    id: 33,
    name: 'Klinikai Informatikai Védelem',
    type: 'expense',
    value: 130_000,
    icon: 'ServerCrash',
    description: 'Páciensadat-védelmi és kibervédelmi tűzfal éves licence. Fizess 130 000 KK-t!',
  },
  {
    id: 34,
    name: 'Sürgősségi Figyelmeztetés',
    type: 'card',
    icon: 'AlertTriangle',
    description: 'Rendkívüli orvosi vagy adminisztratív értesítés! Húzz egy eseménykártyát!',
  },
  {
    id: 35,
    name: 'Külföldi Gyógyturizmus Bevétel',
    type: 'income',
    value: 260_000,
    icon: 'Compass',
    description: 'Külföldi páciensek komplex műtéti és rehabilitációs csomagjai utáni átutalás. +260 000 KK.',
  },
];

export const getTileById = (id: number): Tile | undefined => {
  return BOARD_TILES.find((tile) => tile.id === id);
};
