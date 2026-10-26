# 🏥 CodeBlue - Magánklinika Társasjáték

> **Soproni Egyetem Hackathon 2026** – „Gazdálkodj okosan!” újratöltve, modern egészségügyi köntösben.  
> 🌐 **Éles online verzió:** [https://codeblue.branchlab.tech](https://codeblue.branchlab.tech)

---

## 📋 Tartalomjegyzék

1. [A Játék Célja és Szabályai](#-a-játék-célja-és-szabályai)
2. [Orvosi Karakterek és Szerepkörök](#-orvosi-karakterek-és-szerepkörök)
3. [Játékmódok: Online Multiplayer és Hotseat](#-játékmódok)
4. [A Játéktábla, Kártyák és Részlegek](#-a-játéktábla-kártyák-és-részlegek)
5. [Pénzügyek: Klinikai Bank és Hitel](#-pénzügyek-klinikai-bank-és-hitel)
6. [Zsűri Tesztpanel (DevTools)](#-zsűri-tesztpanel-devtools)
7. [Technológiai Stack és Architektúra](#-technológiai-stack-és-architektúra)
8. [Telepítés és Helyi Futtatás](#-telepítés-és-helyi-futtatás)
9. [Docker és Éles Üzembe Helyezés](#-docker-és-éles-üzembe-helyezés)
10. [Tesztelés és Kódminőség](#-tesztelés-és-kódminőség)

---

## 🎯 A Játék Célja és Szabályai

A **CodeBlue - Magánklinika** egy körökre osztott, stratégiai-gazdasági digitális társasjáték. A játékosok neves orvos-vállalkozók bőrébe bújva építik fel a saját magánklinikájukat. A győzelemhez okos tőkegazdálkodásra, a váratlan események kivédésére és a klinikai kapacitások ütemezett bővítésére van szükség.

### 🏆 Hármas Győzelmi Feltétel:

A játékot az az orvos nyeri meg, aki elsőként teljesíti **mind a 3 feltételt**:

1. **8 / 8 Klinikai Részleg felépült** a klinikáján.
2. **Legalább 1 000 000 KK (Klinikai Korona)** tartaléktőkével rendelkezik.
3. **0 KK banki tartozása van** (minden korábbi hitelt maradéktalanul visszafizetett).

---

## 🩺 Orvosi Karakterek és Szerepkörök

A játékban 4 egyedi orvosi karakter választható, saját portréval, titulusokkal és színkóddal:

| Karakter           | Titulus                            | Szerepkör                                                                 | Színkód                   |
| :----------------- | :--------------------------------- | :------------------------------------------------------------------------ | :------------------------ |
| **Dr. Sebész**     | Vezető Sebészorvos                 | Hidegvérű precizitás a műtőben, sürgősségi beavatkozások mestere.         | `#00b4d8` (Ciánkék)       |
| **Dr. Diagnoszta** | Képalkotó és Belgyógyász Szakorvos | Kiemelkedő analitikus készség, komplex diagnosztika és leletértékelés.    | `#7209b7` (Lila)          |
| **Dr. Főorvos**    | Orvos-igazgató & Intézetvezető     | Kiváló stratégiai és intézményvezetési érzék, akkreditációk nagymestere.  | `#2a9d8f` (Smaragdzöld)   |
| **Dr. Rezidens**   | Kutató és Fiatal Szakorvosjelölt   | Fiatalos lendület, modern telemedicina és mesterséges intelligencia híve. | `#f77f00` (Meleg Narancs) |

---

## 🎮 Játékmódok

### 1. 🌐 Online Multiplayer (Valós idejű WebSocket)

- **Akár 4 külön orvos** játszhat valós időben, 4 különböző laptopról vagy mobiltelefonról.
- **Könnyen megosztható szobakódok:** 4-jegyű egyedi kódok (pl. `CB-6250`).
- **Valós idejű állapot-szinkronizáció:** Socket.io kétirányú adatkapcsolat, automatikus körváltás, szobavezérlés és lecsatlakozás/visszacsatlakozás kezelés.

### 2. 👥 Helyi Játék (Hotseat)

- 2–4 játékos játszik ugyanazon az egy képernyőn.
- Felváltva dobnak és döntenek a bővítésekről, ideális egygépes bemutatókhoz és hackathon prezentációkhoz.

---

## 🗺️ A Játéktábla, Kártyák és Részlegek

### 36 Mezőből Álló Periméter Tábla:

- **0. START Mező:** Minden áthaladáskor **+300 000 KK** orvosi támogatás jár.
- **Bevételi Mezők (Zöld):** Magánrendelés bevétele, Telemedicina konzultáció, Klinikai audit prémium.
- **Kiadási Mezők (Piros):** Műszerlízing, Kamarai tagdíj, Sürgősségi rezsiköltség, Műhiba-biztosítás.
- **Klinikai Hírek & Események (Kék):** Kártyahúzás a 40 lapos pakliból.
- **Részlegvásárlási Lehetőség (Lila):** Lehetőség új osztályok megvásárlására.
- **Speciális Mezők:**
  - _Szirénázó Rohammentő:_ Kiemelt sürgősségi bónusz vagy azonnali beavatkozás.
  - _Orvoskongresszus:_ Szakmai kapcsolatépítés és előadói díj.
  - _Kamarai Audit:_ Pénzügyi és minőségi átvilágítás.

### 🃏 40 Darabos Eseménykártya Pakli:

- **12 db Bevételi kártya:** Állami kutatási támogatás, VIP adomány, sikeres gyógyszerkísérlet.
- **12 db Kiadási kártya:** Elromlott CT gép javítása, ÁNTSZ ellenőrzés bírsága, szoftverlicenc megújítás.
- **8 db Előnykártya:** Extra kockadobás, ingyenes részlegbővítés, mentőautó elsőbbség.
- **8 db Hátránykártya:** Kötelező továbbképzés miatti körből kimaradás, karantén visszalépés.

### 🏗️ 8 Megépíthető Klinikai Részleg:

1. Sürgősségi Betegellátó Osztály (SBO)
2. Belgyógyászat & Kardiológia
3. Sebészeti Műtőblokk
4. Képalkotó Diagnosztika (CT & MRI)
5. Központi Laboratórium
6. Intenzív Terápiás Osztály (ITO)
7. Rehabilitációs és Gyógytorna Központ
8. VIP Prémium Fekvőbeteg Lakosztály

---

## 🏦 Pénzügyek: Klinikai Bank és Hitel

A játékosok bármikor megnyithatják a **Klinikai Bank** panelt:

- **Hitel felvétele:** Fix konstrukciókban (100 000 KK – 500 000 KK lépcsőkben) a gyors terjeszkedéshez.
- **Kamat és Törlesztés:** A felvett hiteleket kötelező visszafizetni a végső győzelemhez.
- **Csődelkerülés:** A likviditás menedzselése kritikus fontosságú.

---

## 🛠️ Zsűri Tesztpanel (DevTools)

A hackathon zsűrizésének megkönnyítésére beépítettünk egy **Zsűri Mód** tesztpanelt:

- **Elérés:** A felső fejléc **„Zsűri Mód”** gombjával, vagy az URL-ben `?demo=1` paraméterrel.
- **Funkciók:**
  - 💰 _Tőke beállítása:_ Bármelyik játékos pénzének azonnali növelése/csökkentése.
  - 📍 _Teleportálás:_ Bármelyik bábu áthelyezése a 36 mező bármelyikére.
  - 🎴 _Kártyaválasztó:_ Mind a 40 kártya tetszőleges előhívása és tesztelése.
  - 🏆 _Azonnali Győzelem:_ 1-kattintásos győzelmi állapot előidézése a díjátadó és funkcióbemutató gyorsításához.
  - 🔊 _Web Audio teszter:_ Mind a 4 egyedi szintetizált hanghatás külön tesztelése és némítása.

---

## 💻 Technológiai Stack és Architektúra

### Frontend:

- **React 19** & **TypeScript**
- **Vite** villámgyors HMR és optimalizált production build
- **Vanilla CSS Design System:** Prémium dark mode, glassmorphism, zökkenőmentes reszponzivitás és micro-animációk
- **Web Audio API:** Dinamikusan szintetizált orvosi hangeffektek (kockadobás, pénzmozgás, sziréna, fanfár)
- **Lucide Icons** modern vektoros ikonográfia

### Backend:

- **Node.js 20 & Express**
- **Socket.io (WebSocket):** Valós idejű szobakezelés, állapotközvetítés, hurokvédelemmel ellátott kétirányú szinkronizáció
- **Biztonsági réteg:** Bemeneti szanitáció (XSS szűrés, 32 karakternél hosszabb nevek levágása, szigorú `CB-XXXX` kódellenőrzés), kapcsolatonkénti rate limiting (40 esemény/mp limit), elhagyott szobák automatikus memóriatisztítása (TTL GC), globális összeomlásvédelem

### Infrastruktúra & DevOps:

- **Docker & Docker Compose:** Izolált konténeres futtatás
- **Oracle Cloud Infrastructure (OCI):** Éles felhő infrastruktúra
- **Caddy Reverse Proxy:** Automatikus Let's Encrypt SSL/TLS tanúsítványkezelés a `codeblue.branchlab.tech` domainen

---

## 🚀 Telepítés és Helyi Futtatás

### Előfeltételek:

- [Node.js](https://nodejs.org/) (20.x vagy újabb)
- npm (Node csomagkezelő)

### 1. Függőségek telepítése:

```bash
git clone https://github.com/Uni-Sopron/codeblue.git
cd codeblue
npm install
```

### 2. Fejlesztői szerver indítása (Frontend):

```bash
npm run dev
```

Nyisd meg a böngészőben: `http://localhost:5173/`

### 3. Multiplayer backend indítása helyben:

Egy külön terminálban:

```bash
cd server
npm install
npm start
```

A szerver a `http://localhost:3001` porton figyel.

---

## 🐳 Docker és Éles Üzembe Helyezés

A teljes alkalmazás (frontend build + Socket.io backend) egyetlen Docker konténerként is futtatható:

```bash
# 1. Frontend lefordítása és statikus fájlok frissítése
npm run build
powershell -Command "Copy-Item -Recurse -Force dist/* server/public/"

# 2. Docker konténer indítása
docker compose up -d --build
```

A backend konténer a 3001-es porton indul el, és zökkenőmentesen integrálódik meglévő reverse proxy hálózatokba (pl. Caddy / Nginx).

---

## 🧪 Tesztelés és Kódminőség

A projekt kiterjedt beépített tesztkészlettel rendelkezik Node.js beépített tesztfuttatójával:

```bash
# Egységtesztek futtatása (játékmotor, hangok, biztonsági szanitáció és multiplayer invariánsok)
npm test

# Típus- és stílusellenőrzés
npm run lint

# Production build tesztelése
npm run build
```

- **Egységtesztek:** 21 / 21 automatizált teszt zölden fut.
- **Linter:** 0 hiba, 0 figyelmeztetés.
- **Típusellenőrzés:** Szigorú TypeScript fordítás (`tsc -b`).

---

## 👥 Készítők & Licenc

Készült a **Soproni Egyetem Hackathon 2026** alkalmából a CodeBlue csapat által.  
Minden jog fenntartva.
