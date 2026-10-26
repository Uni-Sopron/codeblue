# CodeBlue - Magánklinika Társasjáték

Soproni Egyetem Hackathon 2026 - „Gazdálkodj okosan!” újratöltve.

Egy körökre osztott digitális társasjáték **React + Vite + TypeScript** technológiai stacket használva.

---

## 🚀 Telepítés és Indítás (Getting Started)

### Előfeltételek (Prerequisites)

- [Node.js](https://nodejs.org/) (22.18+; a tesztek a beépített TypeScript-támogatást használják)
- npm (a Node.js-szel együtt érkezik)

---

### 1. Függőségek telepítése (Install Dependencies)

A projekt mappájában (`codeblue/`) futtasd az alábbi parancsot:

```bash
npm install
```

---

### 2. Fejlesztői szerver indítása (Development Server)

A helyi fejlesztői szerver indításához:

```bash
npm run dev
```

A parancs lefutása után a terminálban megjelenő címen (alapértelmezetten `http://localhost:5173/`) böngészőből megnyitható a játék.

---

### 3. Ellenőrzés és Linter (Linting)

A kódminőség és típushelyesség ellenőrzéséhez:

```bash
npm run lint
```

---

### 4. Éles build készítése (Production Build)

A statikus, bárhol hosztolható csomag előállítása:

```bash
npm run build
```

Az elkészült fájlok a `dist/` mappába kerülnek, amelyek azonnal közzétehetők GitHub Pages-en, Vercelen vagy Netlify-on.

---

## 🛠️ Használt Technológiák

- **React 19**
- **Vite**
- **TypeScript**
- **ESLint**

## Zsűri tesztpanel és hangok – #6

A `feature/demo-devtools` ág a meglévő `feature/clinic-and-modals` ágra épül,
amely már tartalmazza a játékmotort és az adatokat. A `develop` ágba történő
beolvasztáskor ezekre a függőségekre is szükség van. A teljes játéktábla
összeillesztése külön feladat (#7).

### Kipróbálás

```bash
npm ci
npm run dev
```

Nyisd meg a **http://localhost:5173/?demo=1** címet. Ez az önálló bemutató
a valódi `useGameEngine` hookot, kártyahatásokat és meglévő modalokat használja.
A paraméter nélküli kezdőoldalt ez a feladat nem cseréli le.

1. Indíts egy bemutatót 2–4 orvossal, majd nyisd le a **Zsűri tesztpanelt**.
2. Válassz játékost, és adj hozzá vagy vonj le **1 000 000 KK**-t.
   A levonás gombja nem enged negatív egyenleget.
3. Válassz a 36 célmező közül, majd kattints a **Bábu áthelyezése** gombra.
   Ez csak a pozíciót módosítja, START-bónusz és mezőhatás nélkül.
4. Válassz a 40 kártya közül. A **Kártya megnyitása** a soron lévő
   játékos kártyamodálját nyitja meg; a hatás a **Végrehajtás & Folytatás**
   gombbal érvényesül. Már elhasznált lap is újratesztelhető, paklibeli duplikáció nélkül.
5. A **Győzelem bemutatása** a soron lévő játékos mind a 8 részlegét felépíti,
   nullázza a tartozását, legalább 1 000 000 KK-ra emeli a tőkéjét, és megnyitja
   a meglévő animált győzelmi ablakot. Az **Új játék indítása** alapállapotba tér vissza.

A tesztakciók dobás előtt és építkezéskor érhetők el. Folyamatban lévő dobás,
nyitott kártya és lezárt játék közben le vannak tiltva. Minden módosítás
`[Zsűri teszt]` jelöléssel kerül az eseménynaplóba.

### Hangok

A négy effekt a Web Audio API-val készül, külső hangfájl nélkül:
kockacsörgés, pénzcsilingelés, kártyasuhogás és győzelmi fanfár.
A panelen külön is kipróbálhatók. A hang a böngésző első kattintása vagy
billentyűlenyomása után indulhat; a némítás beállítását az alkalmazás megjegyzi.
Ha a Web Audio API nem támogatott vagy a böngésző blokkolja, a játék csendben működik tovább.

### Bekötés a teljes játékba

Az `App.tsx`-beli bemutatókapu és a `DemoScreen.tsx` csak az önálló ellenőrzést szolgálja.
A végleges játékban egyszer, a közös játékmotor mellett használd:

```tsx
const engine = useGameEngine();
const audio = useGameAudio(engine.gameState);

<DevPanel
  gameState={engine.gameState}
  onAdjustCash={engine.devAdjustCash}
  onTeleport={engine.devTeleport}
  onDrawCard={engine.devDrawCard}
  onInstantVictory={engine.devInstantVictory}
  soundEnabled={audio.soundEnabled}
  onSoundEnabledChange={audio.setSoundEnabled}
  onPreviewSound={audio.previewSound}
/>
```

A kártyamodált a `phase === 'card_modal'`, a győzelmi ablakot a
`phase === 'game_over'` állapothoz kösd, ahogy a `DemoScreen` is teszi.
A hanghook egyszer legyen felcsatolva, hogy ne duplázódjanak az effektek.
Az önálló `playSound('dice' | 'money' | 'card' | 'victory')` függvény is exportált,
de ugyanazt az eseményt ne hangosítsd a hookkal és kézi hívással is.

### Ellenőrzés

```bash
npm test
npm run lint
npm run build
```
