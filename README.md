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

A `feature/demo-devtools` a `feature/clinic-and-modals` ágra épül, annak
játékmotorját, adatait és komponenseit használja. A teljes játéktábla
összeillesztése a #7-es feladat.

### Kipróbálás

```bash
npm ci
npm run dev
```

Nyisd meg a **http://localhost:5173/?demo=1** címet, indíts játékot, és nyisd le
a tesztpanelt. Pénzt és pozíciót a kiválasztott játékosnál módosíthatsz;
a kártyahúzás és a győzelemteszt a soron lévő játékost érinti.
A teleport nem indít mezőhatást, a kártyahatás jóváhagyáskor érvényesül.

A négy Web Audio effekt külön is kipróbálható és némítható. A hanghoz első
kattintás vagy billentyűlenyomás szükséges. A némítást az alkalmazás megjegyzi.

### Bekötés a teljes játékba

A `DemoScreen` külön próbafelület. A végleges játékban a közös játékmotorhoz kösd a panelt:

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

A kártyamodált a `card_modal`, a győzelmi ablakot a `game_over` fázis nyitja.
A `useGameAudio` hookot egyszer használd, és mellette ugyanarra az eseményre
ne hívd külön a `playSound` függvényt, mert megkettőzné a hangot.

### Ellenőrzés

```bash
npm test
npm run lint
npm run build
```
