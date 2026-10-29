import type { Card } from '../types/game.ts';

/**
 * A játék mind a 40 db orvosi eseménykártyája (1 - 40)
 * Az elfogadási feltételek (Acceptance Criteria) szerinti szigorú kategóriaeloszlással és működő játékhatásokkal:
 * 
 * - 12 db income (bevételi kártyák, pl. Állami Kutatási Támogatás, Hálás VIP Adománya)
 * - 12 db expense (kiadási kártyák, pl. CT Javítás, ÁNTSZ Bírság, Sürgős Műszerlízing)
 * - 8 db advantage (előnykártyák, pl. Extra dobás, Ingyenes fejlesztés, Mentőautó elsőbbség)
 * - 8 db disadvantage (hátránykártyák, pl. Kötelező Továbbképzés miatti kimaradás, Karantén miatti visszalépés)
 */
export const EVENT_CARDS: Card[] = [
  // =========================================================================
  // 1. BEVÉTELI KÁRTYÁK (12 db: 1 - 12)
  // =========================================================================
  {
    id: 1,
    category: 'income',
    title: 'Állami Kutatási Támogatás',
    description: 'Nyertél az Országos Innovációs Alap pályázatán. Írj jóvá 350 000 KK-t!',
    flavorText: 'A klinika által benyújtott sejtterápiás kutatási terv a legmagasabb pontszámot kapta a bírálóbizottságtól.',
    action: {
      type: 'cash_reward',
      amount: 350_000,
    },
  },
  {
    id: 2,
    category: 'income',
    title: 'Hálás VIP Adománya',
    description: 'Egy hálás volt páciens alapítványi adományt utalt át a klinikának. Kapsz 250 000 KK-t!',
    flavorText: '„Köszönöm a diszkrét gondoskodást és a szakértelmet, amellyel a családom felé fordultak.”',
    action: {
      type: 'cash_reward',
      amount: 250_000,
    },
  },
  {
    id: 3,
    category: 'income',
    title: 'Nemzetközi Szabadalmi Jogdíj',
    description: 'A klinika által kifejlesztett mikrosebészeti eszközt licencelték. Írj jóvá 400 000 KK-t!',
    flavorText: 'Egy svájci orvostechnológiai óriásvállalat megvásárolta a gyártási jogokat a következő 5 évre.',
    action: {
      type: 'cash_reward',
      amount: 400_000,
    },
  },
  {
    id: 4,
    category: 'income',
    title: 'Vezérigazgatói Sikerdíj',
    description: 'A negyedéves pácienselégedettség meghaladta a 98%-ot. Prémium jóváírás: 200 000 KK.',
    flavorText: 'A független minőségellenőrző kamara a régió legmegbízhatóbb magánintézményének választotta a klinikát.',
    action: {
      type: 'cash_reward',
      amount: 200_000,
    },
  },
  {
    id: 5,
    category: 'income',
    title: 'Klinikai Farmakológiai Eredményesség',
    description: 'Sikeresen lezárult egy újgenerációs gyógyszerkísérlet. Kutatási sikerdíj: 300 000 KK.',
    flavorText: 'A fázisvizsgálatok kiemelkedő hatékonyságot és zéró mellékhatást mutattak a kontrollcsoportban.',
    action: {
      type: 'cash_reward',
      amount: 300_000,
    },
  },
  {
    id: 6,
    category: 'income',
    title: 'VIP Diplomata Ellátása',
    description: 'Külföldi delegáció vette igénybe a prémium sürgősségi ellátást. Térítés: 180 000 KK.',
    flavorText: 'A nagykövetség külön hivatalos levélben fejezte ki elismerését az orvosi csapat gyorsaságáért.',
    action: {
      type: 'cash_reward',
      amount: 180_000,
    },
  },
  {
    id: 7,
    category: 'income',
    title: 'Biztosítói Prémiumelszámolás',
    description: 'A magánbiztosítók jóváhagyták a műtéti finanszírozási keretet. Átutalás: 220 000 KK.',
    flavorText: 'A jogi és pénzügyi osztály sikeresen bizonyította a modern eljárások költséghatékonyságát.',
    action: {
      type: 'cash_reward',
      amount: 220_000,
    },
  },
  {
    id: 8,
    category: 'income',
    title: 'Egészségügyi Innovációs Nagydíj',
    description: 'A szakmai minisztérium a leginnovatívabb klinikának járó díjjal jutalmazott. Főnyeremény: 500 000 KK!',
    flavorText: 'A gálaesten a szakma legelismertebb professzorai méltatták a klinika kimagasló színvonalát.',
    action: {
      type: 'cash_reward',
      amount: 500_000,
    },
  },
  {
    id: 9,
    category: 'income',
    title: 'Adókedvezmény K+F Beruházásokra',
    description: 'Az adóhatóság jóváírta az orvostechnikai beruházások amortizációs adókedvezményét: +280 000 KK.',
    flavorText: 'A gazdasági vezetőség alapos munkájának köszönhetően jelentős forrás szabadult fel.',
    action: {
      type: 'cash_reward',
      amount: 280_000,
    },
  },
  {
    id: 10,
    category: 'income',
    title: 'Orvosi Magazin Címlapsztori',
    description: 'Szakmai interjú a klinika vezetőjével és stábjával. Szakértői tiszteletdíj: 150 000 KK.',
    flavorText: 'Az országos sajtómegjelenést követően ugrásszerűen megnőtt a bejelentkező magánpáciensek száma.',
    action: {
      type: 'cash_reward',
      amount: 150_000,
    },
  },
  {
    id: 11,
    category: 'income',
    title: 'Telemedicina Szoftverlicenc Eladás',
    description: 'Társintézmények megvásárolták a klinika távkonzultációs modulját. Jogdíjbevétel: 320 000 KK.',
    flavorText: 'A modern digitális leletkezelő rendszer a határontúli klinikák körében is népszerűvé vált.',
    action: {
      type: 'cash_reward',
      amount: 320_000,
    },
  },
  {
    id: 12,
    category: 'income',
    title: 'Hétvégi Esztétikai Sebészeti Csúcs',
    description: 'Kiemelkedő kereslet a plasztikai és rehabilitációs konzultációkra. Jóváírás: 240 000 KK.',
    flavorText: 'A páciensek hetekre előre feltöltötték az összes szabad beavatkozási idősávot.',
    action: {
      type: 'cash_reward',
      amount: 240_000,
    },
  },

  // =========================================================================
  // 2. KIADÁSI KÁRTYÁK (12 db: 13 - 24)
  // =========================================================================
  {
    id: 13,
    category: 'expense',
    title: 'CT Javítás és Szenzorcsere',
    description: 'A nagyfelbontású CT képalkotó szenzora meghibásodott. Sürgősségi szerviz: fizess 250 000 KK-t!',
    flavorText: 'A precíz diagnosztika megőrzése érdekében az azonnali gyári kalibráció nem halasztható.',
    action: {
      type: 'cash_penalty',
      amount: 250_000,
    },
  },
  {
    id: 14,
    category: 'expense',
    title: 'ÁNTSZ Bírság',
    description: 'Hatósági ellenőrzés adminisztratív hiányosságokat talált a fertőtlenítési naplóban. Bírság: 150 000 KK.',
    flavorText: 'Az azonnali hatósági határozat fellebbezés nélküli befizetésre kötelezi a klinikát.',
    action: {
      type: 'cash_penalty',
      amount: 150_000,
    },
  },
  {
    id: 15,
    category: 'expense',
    title: 'Sürgős Műszerlízing Törlesztő',
    description: 'Esedékessé vált az orvosi laparoszkópos torony negyedéves lízingdíja. Fizess 200 000 KK-t!',
    flavorText: 'A prémium műszerek zökkenőmentes rendelkezésre állásához pontos törlesztés szükséges.',
    action: {
      type: 'cash_penalty',
      amount: 200_000,
    },
  },
  {
    id: 16,
    category: 'expense',
    title: 'Kiberbiztonsági Incidens és Zsarolóvírus',
    description: 'Hackertámadás érte a betegnyilvántartót. Biztonsági helyreállítás és audit: 300 000 KK.',
    flavorText: 'A legmagasabb szintű katonai titkosítású adatmentési szakértőket kellett bevonni az elhárításba.',
    action: {
      type: 'cash_penalty',
      amount: 300_000,
    },
  },
  {
    id: 17,
    category: 'expense',
    title: 'Sürgős Tisztatéri Légtechnika Csere',
    description: 'A HEPA-szűrők telítődtek a nagyműtőben. Azonnali szűrőcsere és fertőtlenítés: 180 000 KK.',
    flavorText: 'A steril levegő cirkulációja nélkül a műtéteket kötelező jelleggel szüneteltetni kellett.',
    action: {
      type: 'cash_penalty',
      amount: 180_000,
    },
  },
  {
    id: 18,
    category: 'expense',
    title: 'Szakorvosi Bérkompenzáció',
    description: 'A kulcsszakorvosok megtartása érdekében bérrendezést hajtottál végre. Kiadás: 220 000 KK.',
    flavorText: 'A külföldi és konkurens ajánlatokat csak azonnali versenyképes juttatási csomaggal lehetett ellensúlyozni.',
    action: {
      type: 'cash_penalty',
      amount: 220_000,
    },
  },
  {
    id: 19,
    category: 'expense',
    title: 'Márkavédelmi Jogviták',
    description: 'Egy nemzetközi magánklinika-hálózat védjegybitorlással vádolt. Ügyvédi letét: 170 000 KK.',
    flavorText: 'A szellemi tulajdonjog védelme és a bírósági képviselet elkerülhetetlen kiadásokkal jár.',
    action: {
      type: 'cash_penalty',
      amount: 170_000,
    },
  },
  {
    id: 20,
    category: 'expense',
    title: 'Autokláv és Gőzsterilizáló Meghibásodás',
    description: 'Kiolvadt a nagynyomású gőzfejlesztő fűtőszála. Csere és szervizköltség: 190 000 KK.',
    flavorText: 'A sebészeti műszerek csírátlanítása nem tűr halasztást a műtéti program fenntartásához.',
    action: {
      type: 'cash_penalty',
      amount: 190_000,
    },
  },
  {
    id: 21,
    category: 'expense',
    title: 'Sürgősségi Túlórapótlékok Kifizetése',
    description: 'Járványügyi készültség miatt a személyzet dupla műszakban dolgozott. Kifizetés: 140 000 KK.',
    flavorText: 'A klinika elhivatott ápolói és szakasszisztensei kitartóan helytálltak az éjszakai műszakban.',
    action: {
      type: 'cash_penalty',
      amount: 140_000,
    },
  },
  {
    id: 22,
    category: 'expense',
    title: 'Vagyonarányos Szolidaritási Adó',
    description: 'Rendkívüli egészségügyi ágazati különadó: fizesd be készpénzed 10%-át!',
    flavorText: 'Az állami egészségbiztosító költségvetési hiányát a magánszektor extra terhelésével kompenzálják.',
    action: {
      type: 'tax_percentage',
      amount: 10,
    },
  },
  {
    id: 23,
    category: 'expense',
    title: 'Elveszett Minta Miatti Vizsgálatismétlés',
    description: 'Logisztikai hiba miatt tönkrement egy szállítmány szövettani minta. Kártérítés: 120 000 KK.',
    flavorText: 'A páciensek felé felajánlott ingyenes ismétlés és a kártalanítás költségeit azonnal rendezni kell.',
    action: {
      type: 'cash_penalty',
      amount: 120_000,
    },
  },
  {
    id: 24,
    category: 'expense',
    title: 'Környezetvédelmi Termékdíj Hátralék',
    description: 'A felhasznált egyszerhasználatos műanyag orvosi eszközök utáni pótadó. Levonás: 160 000 KK.',
    flavorText: 'Az európai zöld átállási irányelv szigorúbb ellenőrzést vezetett be az orvosi műanyagokra.',
    action: {
      type: 'cash_penalty',
      amount: 160_000,
    },
  },

  // =========================================================================
  // 3. ELŐNY KÁRTYÁK (8 db: 25 - 32)
  // =========================================================================
  {
    id: 25,
    category: 'advantage',
    title: 'Extra Dobás - Zöld Hullám',
    description: 'Kiváló orvosi koordináció! Azonnal dobhatsz még egyet a kockával!',
    flavorText: 'A diszpécserközpont azonnal szabaddá tette az utat, a csapat lendületben van.',
    action: {
      type: 'extra_roll',
    },
  },
  {
    id: 26,
    category: 'advantage',
    title: 'Orvostechnikai Beszállítói Akció',
    description: 'Exkluzív partnerkedvezmény! A következő építkezésed árából 25% árengedményt kapsz!',
    flavorText: 'A berendezésgyártó referenciaklinikaként kezeli intézményedet, így gyári beszerzési árat biztosít.',
    action: {
      type: 'discount_building',
      discountPercent: 25,
    },
  },
  {
    id: 27,
    category: 'advantage',
    title: 'Mentőautó Elsőbbség',
    description: 'Sürgősségi elsőbbségi folyosó! Lépj előre 3 mezőt, és aktiváld a célmező eseményét!',
    flavorText: 'A szirénázó rohamkocsi minden közlekedési akadályt pillanatok alatt kikerült.',
    action: {
      type: 'move_relative',
      steps: 3,
    },
  },
  {
    id: 28,
    category: 'advantage',
    title: 'Gyorsított Audit a START Mezőn',
    description: 'Azonnal ugorj a START mezőre és vedd fel a 300 000 KK fenntartási támogatást!',
    flavorText: 'Az akkreditációs bizottság azonnali helyszíni szemlére rendelt a főbejárathoz, amelyet elismeréssel zártak.',
    action: {
      type: 'move_absolute',
      targetTileId: 0,
      amount: 300_000,
    },
  },
  {
    id: 29,
    category: 'advantage',
    title: 'Kormányzati Beruházási Támogatás',
    description: 'Stratégiai partnerségi megállapodás! 30% kedvezmény a legközelebbi beruházásodra!',
    flavorText: 'A térségi egészségfejlesztési program keretében kiemelt állami támogatást nyertél.',
    action: {
      type: 'discount_building',
      discountPercent: 30,
    },
  },
  {
    id: 30,
    category: 'advantage',
    title: 'Innovatív Orvos-igazgatói Lendület',
    description: 'Páratlan szervezettség a klinikán. Azonnal kapsz egy extra dobási lehetőséget!',
    flavorText: 'A precíz munkaszervezésnek köszönhetően órákkal a tervezett idő előtt végeztek a teljes programmal.',
    action: {
      type: 'extra_roll',
    },
  },
  {
    id: 31,
    category: 'advantage',
    title: 'Ingyenes Részleg Fejlesztés',
    description: 'Alapítványi adomány! Ha még nincs Recepciód, most ingyen felépül, egyébként kapsz 200 000 KK-t!',
    flavorText: 'Egy külföldi orvosi alapítvány a legmodernebb betegfogadó bútorzatot adományozta intézményednek.',
    action: {
      type: 'free_building',
      targetElementId: 'reception',
      amount: 200_000,
    },
  },
  {
    id: 32,
    category: 'advantage',
    title: 'Gyorsított Betegfelvételi Folyosó',
    description: 'Digitális betegút-menedzsment bevezetése. Lépj előre 4 mezőt!',
    flavorText: 'Az érintőképernyős regisztrációval a várakozási idő gyakorlatilag nullára csökkent.',
    action: {
      type: 'move_relative',
      steps: 4,
    },
  },

  // =========================================================================
  // 4. HÁTRÁNY KÁRTYÁK (8 db: 33 - 40)
  // =========================================================================
  {
    id: 33,
    category: 'disadvantage',
    title: 'Kötelező Továbbképzés miatti Kimaradás',
    description: 'Országos szakmai akkreditációs vizsgán veszel részt. A következő 1 körből kimaradsz!',
    flavorText: 'A legújabb orvosi protokollok elsajátítása kötelező a praktizálási engedély megújításához.',
    action: {
      type: 'skip_turn',
    },
  },
  {
    id: 34,
    category: 'disadvantage',
    title: 'Karantén miatti Visszalépés',
    description: 'Vírusfertőzés gyanúja miatt lezárták a folyosót. Lépj vissza 3 mezőt!',
    flavorText: 'A szigorú fertőzésvédelmi eljárások azonnali izolációt és visszalépést írnak elő.',
    action: {
      type: 'move_relative',
      steps: -3,
    },
  },
  {
    id: 35,
    category: 'disadvantage',
    title: 'Etikai Bizottsági Meghallgatás',
    description: 'Panaszbejelentés kamarai vizsgálata zajlik. 1 körből kötelezően kimaradsz!',
    flavorText: 'A kamara zárt ajtók mögött hallgatja meg az érintett osztályvezető főorvost.',
    action: {
      type: 'skip_turn',
    },
  },
  {
    id: 36,
    category: 'disadvantage',
    title: 'Mentőautó Műszaki Hibája',
    description: 'Defektet kapott a rohamkocsi az autópályán. Lépj vissza 2 mezőt!',
    flavorText: 'Míg a csereautó megérkezett a szervizből, a betegszállítás átmenetileg lelassult.',
    action: {
      type: 'move_relative',
      steps: -2,
    },
  },
  {
    id: 37,
    category: 'disadvantage',
    title: 'Rendkívüli Kamarai Felülvizsgálat',
    description: 'Vonulj az Etikai Bizottság & Pihenőpark mezőre (9-es mező) iratbetekintésre!',
    flavorText: 'Az orvosi kamara felügyeleti csoportja haladéktalanul berendelt a bizottsági ülésre.',
    action: {
      type: 'move_absolute',
      targetTileId: 9,
    },
  },
  {
    id: 38,
    category: 'disadvantage',
    title: 'Központi Informatikai Rendszerösszeomlás',
    description: 'A felhőalapú betegadatbázis leállt, a betegfelvétel megbénult. 1 körből kimaradsz!',
    flavorText: 'Papíralapon kell adminisztrálni az összes vizsgálatot, amíg a mérnökök helyreállítják a szervert.',
    action: {
      type: 'skip_turn',
    },
  },
  {
    id: 39,
    category: 'disadvantage',
    title: 'Útlezárás és Közműépítés a Klinika Körül',
    description: 'A mentőfelhajtó lezárásra került. Lépj vissza 4 mezőt a terelőúton!',
    flavorText: 'A városi csatornázási munkálatok miatt nehézkes a klinika gépjárműves megközelítése.',
    action: {
      type: 'move_relative',
      steps: -4,
    },
  },
  {
    id: 40,
    category: 'disadvantage',
    title: 'Steril Eszközhiány a Raktárban',
    description: 'A beszállító késve küldte a műtéti textíliákat. Lépj vissza 1 mezőt a leltárhoz!',
    flavorText: 'A raktárosoknak újra kell számolniuk a steril szekrények teljes készletét.',
    action: {
      type: 'move_relative',
      steps: -1,
    },
  },
];

export const getCardById = (id: number): Card | undefined => {
  return EVENT_CARDS.find((card) => card.id === id);
};
