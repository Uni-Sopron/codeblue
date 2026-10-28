# 🏥 CodeBlue - Magánklinika Társasjáték

> **Soproni Egyetem Hackathon 2026** – „Gazdálkodj okosan!” újratöltve, modern egészségügyi köntösben.  
> 🌐 **Éles online verzió:** [https://codeblue.branchlab.tech](https://codeblue.branchlab.tech)  
> ⚡ **CI/CD:** 152 / 152 automatizált egységteszt zölden fut · 0 linter hiba · Docker konténeres felhő üzem

---

## 📋 Tartalomjegyzék

1. [A Játék Lényege: Gazdálkodj okosan orvosi köntösben](#1-a-játék-lényege-gazdálkodj-okosan-orvosi-köntösben)
2. [A Játék Célja és a Hármas Győzelmi Feltétel](#2-a-játék-célja-és-a-hármas-győzelmi-feltétel)
3. [Orvosi Karakterek és Szerepkörök](#3-orvosi-karakterek-és-szerepkörök)
4. [Játékmódok: Online Multiplayer, Hotseat és Bot Demó](#4-játékmódok-online-multiplayer-hotseat-és-bot-demó)
5. [Mesterséges Intelligencia és Autonóm AI Botok](#5-mesterséges-intelligencia-és-autonóm-ai-botok)
6. [A Játéktábla Mezői és a 40 Lapos Eseménykártya Pakli](#6-a-játéktábla-mezői-és-a-40-lapos-eseménykártya-pakli)
7. [A Klinika 8 Megépíthető Részlege](#7-a-klinika-8-megépíthető-részlege)
8. [Pénzügyi Rendszer: Klinikai Bank, Megtakarítás és Hitel](#8-pénzügyi-rendszer-klinikai-bank-megtakarítás-és-hitel)
9. [Fejlesztői Mód (DevTools Tesztpanel)](#9-fejlesztői-mód-devtools-tesztpanel)
10. [Reszponzív Megjelenés és Felhasználói Élmény](#10-reszponzív-megjelenés-és-felhasználói-élmény)
11. [Technológiai Stack és Architektúra](#11-technológiai-stack-és-architektúra)
12. [Telepítés és Helyi Futtatás](#12-telepítés-és-helyi-futtatás)
13. [Docker és Éles Üzembe Helyezés (OCI)](#13-docker-és-éles-üzembe-helyezés-oci)
14. [Tesztelés és Kódminőség (152 Teszt)](#14-tesztelés-és-kódminőség-152-teszt)
15. [Készítők és Licenc](#15-készítők-és-licenc)

---

## 1. A Játék Lényege: Gazdálkodj okosan orvosi köntösben

A **CodeBlue - Magánklinika** a legendás magyar „Gazdálkodj okosan!” társasjáték szellemi örököse, melyet a Soproni Egyetem 2026-os Hackathonjára álmodtunk újra 21. századi, modern egészségügyi-vállalkozói környezetben.

A játékosok nem egy átlagos lakást rendeznek be bútorokkal és háztartási gépekkel, hanem **orvos-vállalkozóként saját csúcstechnológiás magánklinikájukat építik fel**. A játék megőrzi az eredeti társasjáték legélvezetesebb elemeit (kockadobás, körbejárás, váratlan szerencsekártyák, banki betétek, kötelező biztosítások és hitelek), miközben valósághű gazdasági és orvosszakmai döntések elé állítja a résztvevőket.

### 🔄 Párhuzamok a klasszikus és az orvosi verzió között

| Klasszikus „Gazdálkodj okosan!”  | 🏥 CodeBlue - Magánklinika                                           | Gazdasági szerepe a játékban                                                             |
| :------------------------------- | :------------------------------------------------------------------- | :--------------------------------------------------------------------------------------- |
| **Lakásvásárlás és bútorok**     | **8 Klinikai Részleg megépítése** (SBO, Műtőblokk, CT/MRI, ITO stb.) | Hosszú távú infrastrukturális beruházás, a végső győzelem alapköve.                      |
| **Készpénz / Forint**            | **Klinikai Korona (KK)**                                             | A klinika likviditása, amiből fizetjük a fenntartást és a bővítéseket.                   |
| **START mező (Fizetés)**         | **START – Klinika Főbejárat (+300 000 KK)**                          | Körönkénti működési és állami finanszírozási támogatás.                                  |
| **Takarékbetétkönyv / OTP**      | **Klinikai Megtakarítási Betét (kamatozó)**                          | A felesleges tőke biztonságos kamatoztatása a váratlan kiadások ellen.                   |
| **Házgyári hitel / OTP kölcsön** | **Likviditási Banki Hitel**                                          | Gyors tőkeinjekció azonnali építkezéshez, de kötelező kamattal és törlesztéssel.         |
| **Biztosítás / Kötvények**       | **Kórházfejlesztési Kötvény & Részvények**                           | Portfólió-diverzifikáció magasabb hozamért.                                              |
| **Szerencsekártyák**             | **40 db Klinikai Hírek & Eseménykártya**                             | ÁNTSZ auditok, VIP adományok, műszerlízingek, orvosi műhibaperek és kutatási pályázatok. |
| **Kiesés / Csőd**                | **Intézményi Csőd**                                                  | Ha a tőke elfogy és a kötelezettségek nem fizethetők ki, a klinika csődbe megy.          |

---

## 2. A Játék Célja és a Hármas Győzelmi Feltétel

A CodeBlue-ban nem elég csupán gazdagnak lenni vagy felépíteni egy-két osztályt: a valódi sikerhez **komplex, fenntartható kórházmenedzsmentre** van szükség.

### 🏆 A Hármas Győzelmi Feltétel

A játékot az az orvos nyeri meg azonnal, aki elsőként teljesíti **mind a 3 feltételt**:

1. 🏗️ **Mind a 8 Klinikai Részleg felépült:** A klinika teljes orvosszakmai felkészültséget ért el.
2. 💰 **Legalább 1 000 000 KK tartaléktőke:** Rendelkezésre áll a biztonságos, folyamatos működéshez szükséges likvid tőke (készpénzben vagy banki megtakarításban).
3. 🛡️ **0 KK banki tartozás:** Minden korábban felvett hitel maradéktalanul visszafizetésre került; a klinika 100%-ig adósságmentes.

---

## 3. Orvosi Karakterek és Szerepkörök

A játékban 4 különleges orvoskarakter választható, saját egyedi portréval, titulusokkal, szakmai háttérrel és jellegzetes színkóddal:

| Karakter           | Titulus                        | Szakterület & Személyiség                                                                                  | Színkód                  |
| :----------------- | :----------------------------- | :--------------------------------------------------------------------------------------------------------- | :----------------------- |
| **Dr. Sebész**     | Vezető Sebészorvos             | Hidegvérű precizitás a műtőben, sürgősségi beavatkozások és műtéti kapacitásbővítés mestere.               | `#00b4d8` (Ciánkék)      |
| **Dr. Diagnoszta** | Képalkotó & Belgyógyász        | Kiemelkedő analitikus készség, komplex diagnosztika, leletértékelés és adatvezérelt döntések.              | `#7209b7` (Mély Lila)    |
| **Dr. Főorvos**    | Orvos-igazgató & Intézetvezető | Intézményi stratégia, kórházi akkreditációk, pályázatok és a kamarával való kapcsolatok nagymestere.       | `#2a9d8f` (Smaragdzöld)  |
| **Dr. Rezidens**   | Fiatal Szakorvosjelölt         | Fiatalos lendület, innovatív telemedicina, mesterséges intelligencia és modern betegellátási technológiák. | `#f77f00` (Narancssárga) |

---

## 4. Játékmódok: Online Multiplayer, Hotseat és Bot Demó

A játék 3 rugalmas módban játszható:

### 1. 🌐 Valós Idejű Online Multiplayer (Socket.io)

- **Többeszközös élmény:** Akár 4 játékos játszhat egyidejűleg külön mobiltelefonról, táblagépről vagy laptopról.
- **Egyedi 4-jegyű szobakódok:** Gyors szobanyitás (pl. `CB-8421`) és azonnali csatlakozás.
- **Szerverkapacitás:** A backend optimalizált memóriakezeléssel akár **50 párhuzamos játékszobát** képes egyidejűleg kiszolgálni.
- **Újracsatlakozás és lecsatlakozás-védelem:** Ha egy játékos netkapcsolata megszakad, 30 másodperces visszaszámláló indul; az állapot automatikusan szinkronizálódik a visszatéréskor.
- **Szavazásos visszavágó rendszer (Rematch):** A meccs végén egyetlen kattintással újraindítható a parti azonos játékosokkal.

### 2. 👥 Helyi Játék (Hotseat)

- 2–4 orvos játszhat ugyanazon a képernyőn, felváltva használva a kezelőfelületet.
- Ideális egygépes szórakozáshoz, oktatási demonstrációhoz vagy projektbemutatóhoz.

### 3. 🤖 1-Kattintásos Gyors Sablonok és Bot Demó

A helyi beállító képernyőn egyetlen kattintással választható játékmód-sablon:

- **`[🤖 Teljes Bot Harc (Demó)]`**: Mind a 4 orvost AI irányítja; a játék autonóm módon zajlik le a néző szeme előtt.
- **`[👤 1 Ember + Botok]`**: Egyetlen élő játékos küzd meg 1–3 gépi orvos-vállalkozó ellen.
- **`[👥 Hotseat (Csak Emberek)]`**: Klasszikus többemberes társasjáték.

---

## 5. Mesterséges Intelligencia és Autonóm AI Botok

A CodeBlue saját **heurisztikus döntéshozatali motorral** felszerelt AI botokat alkalmaz, amelyek teljes mértékben betartják a játékszabályokat, és emberi segítség nélkül képesek játszani:

### A 4 Neves AI Orvosprofil

1. **Dr. AI Neumann** (Diagnoszta – `#7209b7`): Analitikus szemlélet, diagnosztikai és laboratóriumi fejlesztési fókusz.
2. **Dr. AI Turing** (Főorvos – `#2a9d8f`): Kiegyensúlyozott intézményvezetés, erős likviditási tartalékképzés.
3. **Dr. AI Lovelace** (Rezidens – `#f77f00`): Dinamikus, bátor beruházó, telemedicinás és sürgősségi orientáció.
4. **Dr. AI Hippokratész** (Sebész – `#0284c7`): Sebészeti és műtőblokk-központú stratégia.

### Az AI Döntési Stratégiája

- **Kockadobás & Eseménykezelés:** A bot sorra kerülve azonnal dob a kockával, felolvassa és érvényesíti az eseménykártyákat.
- **Prioritásos Részlegvásárlás:** A kör építési fázisában megvizsgálja a pénzügyi lehetőségeit, és ha van elég tőkéje a 300 000 KK-s biztonsági tartalék felett, megvásárolja a számára legfontosabb hiányzó klinikai részleget.
- **Okos Bankolás és Lekötés:** Ha a bot épített a körben és még mindig rendelkezik felesleges készpénzzel a tartalék felett, **meglátogatja a bankot, és a szabad tőkét megtakarítási betétbe helyezi el kamatozni**, pontosan úgy, mint egy tudatos orvos-vállalkozó.

---

## 6. A Játéktábla Mezői és a 40 Lapos Eseménykártya Pakli

### A 36 Mezőből Álló Periméter Tábla

A játéktábla egy 10×10-es rács külső kerületén fut körbe, 36 gondosan megtervezett mezővel:

- 🚩 **#0. START Mező (Klinika Főbejárat):** Minden áthaladáskor **+300 000 KK** működési támogatást kap az orvos.
- 📈 **Bevételi Mezők (Zöld):** Magánrendelés bevétele, Telemedicina konzultáció, Klinikai audit prémium, Kutatási támogatás.
- 📉 **Kiadási Mezők (Piros):** Műszerlízing, Orvosi Kamarai tagdíj, Sürgősségi rezsiköltség, Műhiba-biztosítás, Informatikai karbantartás.
- ✉️ **Klinikai Hírek & Események (Kék):** Automatikus kártyahúzás a 40 lapos eseménypakliból.
- 🟣 **Részlegvásárlási Mezők (Lila):** Lehetőség új osztályok megvásárlására és hozzáadására a klinikához.
- ⚡ **Speciális Mezők:**
  - **#4. Szirénázó Rohammentő:** Sürgősségi betegszállítás, amely **azonnali extra kockadobást** biztosít a játékosnak!
  - **#18. Orvoskongresszus:** Szakmai előadás megtartása, nemzetközi kapcsolatépítés és előadói tiszteletdíj.
  - **#28. Akkreditációs Vizsga:** Minőségbiztosítási audit a magas szintű betegbiztonságért.
  - **#34. Kamarai Audit:** Pénzügyi átvilágítás a szabályos gazdálkodás ellenőrzésére.

### 🃏 A 40 Lapos Eseménykártya Pakli

A kártyák valós orvosi szituációkat dolgoznak fel, 4 kategóriában:

1. **12 db Bevételi kártya (Zöld):** Állami kutatás-fejlesztési pályázat elnyerése, VIP beteg nagylelkű adománya, nemzetközi gyógyszerkísérlet sikere (+80 000 – +350 000 KK).
2. **12 db Kiadási kártya (Piros):** Elromlott a digitális röntgencső, ÁNTSZ felülvizsgálat büntetése, orvosi szoftverlicenc lejárt (-60 000 – -300 000 KK).
3. **8 db Előnykártya (Kék):** Újabb kockadobás azonnal, ingyenes részlegfejlesztés, orvosi szakmai díj, gyorsított engedélyezés.
4. **8 db Hátránykártya (Sárga):** Kötelező járványügyi karantén miatt visszalépés 3 mezőt, körből kimaradás szigorított kamarai továbbképzés miatt.

---

## 7. A Klinika 8 Megépíthető Részlege

A magánklinika tervrajza 8 kulcsfontosságú orvosi részlegből áll. A győzelemhez mind a 8 részleget fel kell építeni:

|   #    | Részleg Neve                             | Beruházási Költség | Orvosszakmai Funkció                                              |
| :----: | :--------------------------------------- | :----------------: | :---------------------------------------------------------------- |
| **1.** | **Sürgősségi Betegellátó Osztály (SBO)** |     250 000 KK     | 24/7 azonnali betegfogadás, triázs és stabilizálás.               |
| **2.** | **Belgyógyászat & Kardiológia**          |     300 000 KK     | Szív- és érrendszeri kivizsgálás, EKG és ultrahang labor.         |
| **3.** | **Sebészeti Műtőblokk**                  |     450 000 KK     | Steril lamináris légáramlású műtők egynapos és nagysebészethez.   |
| **4.** | **Képalkotó Diagnosztika (CT & MRI)**    |     400 000 KK     | 3 Tesla MRI és 128 szeletes CT csúcstechnológiás leletalkotás.    |
| **5.** | **Központi Laboratórium**                |     200 000 KK     | Automatizált vérkép, biokémiai és mikrobiológiai gyorstesztek.    |
| **6.** | **Intenzív Terápiás Osztály (ITO)**      |     500 000 KK     | Életfunkció-támogató monitorozás, lélegeztetőgépek.               |
| **7.** | **Rehabilitációs és Gyógytorna Központ** |     250 000 KK     | Műtét utáni felépülés, hidroterápia és robotikus mozgásterápia.   |
| **8.** | **VIP Prémium Fekvőbeteg Lakosztály**    |     350 000 KK     | Ötcsillagos hotelszintű elhelyezés és exkluzív orvosi felügyelet. |

---

## 8. Pénzügyi Rendszer: Klinikai Bank, Megtakarítás és Hitel

A fejléc **„Bank”** gombjával elérhető a **Klinikai Bank** központi felülete, ahol a játékosok valós gazdasági tranzakciókat hajthatnak végre:

### 1. 💰 Megtakarítási Betét (Kamatozó)

- A felesleges készpénz bármikor leköthető a banknál.
- A megtakarítás **körönként fix kamatot termel**, és védve van a készpénzt érintő váratlan eseményektől.
- Bármikor díjmentesen visszaváltható likvid készpénzre.

### 2. 📜 Kórházfejlesztési Kötvény & 📈 Klinikai Részvény

- Magasabb hozamú pénzügyi eszközök a hosszú távon gondolkodó orvos-befektetők számára.

### 3. 💳 Likviditási Hitel (Banki Kölcsön)

- Ha egy játékosnak gyorsan tőkére van szüksége egy drága részleg (pl. Műtőblokk vagy ITO) felépítéséhez, hitelt vehet fel 100 000 KK-s lépcsőkben.
- **Kamatfizetési kötelezettség:** A hitel után kamat terheli a játékost.
- **A Győzelem Záloga:** A játékot **nem lehet megnyerni fennálló hiteltartozással**! A győzelemhez a hitelt maradéktalanul vissza kell törleszteni.

---

## 9. Fejlesztői Mód (DevTools Tesztpanel)

A hackathon bemutatók és a zsűrizés megkönnyítésére beépítettünk egy diszkrét, de minden részletre kiterjedő **Fejlesztői Mód** tesztpanelt:

- **Megnyitás:** A felső fejléc sárga kulcs ikonjára kattintva (`Fejlesztői Mód`), vagy az URL-ben `?demo=1` paraméterrel.
- **Főbb Eszközök:**
  - 💰 **Tőke & Hitel Testre Szabása:** Bármelyik orvos pénzének azonnali növelése vagy csökkentése.
  - 📍 **Interaktív Mezőre Teleportálás:** Ha a Fejlesztői Mód aktív, a tábla bármelyik mezőjére rákattintva az aktív bábu azonnal odaugrik, kiváltva a mező hatását.
  - 🃏 **Kártyaválasztó Teszter:** Mind a 40 eseménykártya előnézete és azonnali felhúzása teszteléshez.
  - 🏆 **1-Kattintásos Győzelem:** Azonnali győzelmi állapot generálása a díjátadó és győzelmi animációk bemutatásához.
  - 🔊 **Web Audio Szintetizátor Teszt:** Mind a 7 egyedi szintetizált hanghatás külön-külön tesztelése és némítása:
    - 🎲 **`dice` (Kockadobás):** Dinamikus kockapörgés és asztalon gurulás a dobási fázis alatt.
    - 💰 **`money` (Bevétel / Kassza):** Fényes aranyérme és kasszagép csilingelés támogatások, START bónusz és bevételek jóváírásakor.
    - ⚠️ **`penalty` (Kiadás / Bírság):** Tompa koppanás és lefelé lépdelő mélyebb moll hangok orvosi műhibák, adófizetés és bírságok levonásakor.
    - 🏗️ **`build` (Részlegátadás):** Rezonáns szerkezeti koppanás és büszke C-dúr fanfár új klinikai osztály megvásárlásakor.
    - 🚑 **`siren` (Rohammentő Sziréna):** Kétciklusos európai mentőautó váltókürt a 4-es mezőre („Szirénázó Rohammentő”) érkezéskor.
    - 🃏 **`card` (Kártyahúzás):** Papírlap suhogása az eseménykártyák felhúzásakor és megnyitásakor.
    - 🏆 **`victory` (Győzelmi Fanfár):** Ünnepélyes, rézfúvós hangulatú győzelmi dallam a játék megnyerésekor.

---

## 10. Reszponzív Megjelenés és Felhasználói Élmény

A játék felhasználói felülete asztali gépen, tableten és okostelefonon is kompromisszummentes élményt nyújt:

- **Kompakt 2×2 Mobilos PlayerHUD:** Telefonon a 4 orvosi kártya egy áttekinthető 2 oszlopos rácsba rendeződik, alig 120px-re csökkentve az élő státuszsáv magasságát.
- **Szigorúan Egy Helyben Forgó 3D Kártyák:** A kártyamegjelenítés zárt dobozmodellt (`box-sizing: border-box`) és geometriai középponti forgástengelyt kapott, így mind az asztali nézetben, mind a legkeskenyebb okostelefonokon tökéletesen a saját tengelye körül fordul meg, nulla oldalirányú csúszással vagy kitakarással.
- **Határon Belül Maradó Bábuk:** A bábuk mobilos méretezése és finomított lebegő animációja garantálja, hogy a START mezőn álló 4 bábu sem lóg ki a játéktábla széléről.
- **Kristálytiszta Mezőszámok (0..35):** Minden mező sorszáma tiszta fehér színt, erős kontrasztos sötét árnyékot és kiemelt rétegrendet (`z-index: 20`) kapott.
- **Egygombos Gyorsirányítás (E / Enter):** Asztali gépen a játékiparban elterjedt `E` (vagy `Enter`) billentyűvel a teljes folyamat kézreállóan vezérelhető (Kockadobás ➔ Kártya jóváhagyása ➔ Kör befejezése), anélkül hogy a szóköz véletlen lefelé görgetné az oldalt.

---

## 11. Technológiai Stack és Architektúra

### Frontend Réteg

- **React 19 & TypeScript:** Komponensalapú, szigorúan típusbiztos felületkezelés.
- **Vite 8:** Másodperc alatti Hot Module Replacement (HMR) és optimalizált rollup kötegelés.
- **Vanilla CSS Design System:** Modern sötét téma, glassmorphism effektek, fluid reszponzivitás külső nehézkes CSS keretrendszerek nélkül.
- **Web Audio API:** 7 teljesen procedurális, dinamikusan szintetizált orvosi és játékmechanikai hangeffekt külső MP3 fájlok nélkül (0 KB letöltés, zéró adatforgalom, azonnali reakcióidő).
- **Lucide Icons:** Letisztult orvosi és pénzügyi vektoros ikonográfia.

### Backend Réteg

- **Node.js 20 & Express:** Robusztus HTTP kiszolgálás és REST health endpointok (`/health`).
- **Socket.io (WebSocket):** Valós idejű, kétirányú állapotközvetítés eseményalapú architektúrával.
- **Védelmi és Stabilitási Rendszer:**
  - Szigorú bemeneti szanitáció (XSS szűrés, 32 karakteres névhossz korlát, `CB-XXXX` szobakód validáció).
  - Kapcsolatonkénti rate limiting (40 esemény/másodperc).
  - Automatikus memóriatisztító szemétgyűjtő (TTL Room GC) az elhagyott szobák felszabadítására.
  - Szerverkapacitás korlát: **50 aktív egyidejű szoba** biztonsági plafon.

### Infrastruktúra & Üzemeltetés

- **Docker & Docker Compose:** Egyetlen könnyűsúlyú konténerbe csomagolt frontend és backend.
- **Oracle Cloud Infrastructure (OCI Frankfurt):** Dedikált felhő virtuális gép.
- **Caddy Web Server:** Automatikus Let's Encrypt SSL/TLS reverse proxy a `codeblue.branchlab.tech` domainen.

---

## 12. Telepítés és Helyi Futtatás

### Előfeltételek

- [Node.js](https://nodejs.org/) (20.x vagy újabb verzió)
- npm (Node csomagkezelő)

### 1. A tároló klónozása

```bash
git clone https://github.com/Uni-Sopron/codeblue.git
cd codeblue
npm install
```

### 2. A frontend fejlesztői szerver indítása

```bash
npm run dev
```

A böngészőben nyisd meg: `http://localhost:5173/`

### 3. A helyi multiplayer szerver indítása

Egy külön terminálablakban:

```bash
cd server
npm install
npm start
```

A Socket.io szerver a `http://localhost:3001` porton figyel.

---

## 13. Docker és Éles Üzembe Helyezés (OCI)

A teljes alkalmazás (production frontend build + Socket.io backend) egyetlen Docker konténerként futtatható:

```bash
# 1. Frontend lefordítása és a szerver statikus mappájába másolása
npm run build
powershell -Command "Copy-Item -Recurse -Force dist/* server/public/"

# 2. Docker konténer felépítése és indítása
docker compose up -d --build
```

A backend konténer a 3001-es porton indul el, és közvetlenül illeszkedik a meglévő Caddy vagy Nginx reverse proxy hálózathoz.

---

## 14. Tesztelés és Kódminőség (152 Teszt)

A projekt a Node.js beépített natív tesztfuttatóját (`node --test`) használja, amely villámgyorsan, külső nehézkes könyvtárak nélkül futtat le **152 kiterjedt egységtesztet**:

```bash
# Egységtesztek futtatása (játékmotor, bank, bot stratégia, hangok, szanitáció, szobainvariánsok)
npm test

# Szigorú ESLint kódstílus-ellenőrzés
npm run lint

# TypeScript típusellenőrzés és production build
npm run build
```

### ✅ Tesztelési Lefedettség

- **152 / 152 automatizált teszt sikeres (0 hiba):**
  - Játékmotor fázisátmenetek, kockadobás, mezőhatások és győzelmi feltételek.
  - Klinikai Bank: kamatszámítás, betételhelyezés, hitelfelvétel és törlesztési invariánsok.
  - AI Bot heurisztika: önálló döntéshozatal, részlegvásárlás és többlettőke-lekötés.
  - Web Audio hangszintetizátor mind a 7 eljárási profilja, némítási állapota és felhasználói interakciós zárai.
  - WebSocket szobakezelés: szobakód-validáció, XSS szanitáció, 50 szobás plafon és visszacsatlakozási időzítők.
- **ESLint:** 0 hiba, 0 figyelmeztetés.
- **TypeScript:** Szigorú típusellenőrzés (`tsc -b`).

---

## 15. Készítők és Licenc

Készült a **Soproni Egyetem Hackathon 2026** alkalmából.

### 🌟 CodeBlue Csapat

- 👨‍💻 **Wild Péter**
- 👨‍💻 **Morvai Márkó**
- 👩‍💻 **Moldicz Dzsenifer Fanni**

---

Minden jog fenntartva © 2026 CodeBlue Csapat – Soproni Egyetem.
