export type SoundEffect =
  | "dice"
  | "money"
  | "penalty"
  | "build"
  | "siren"
  | "card"
  | "victory";

const SOUND_PREFERENCE_KEY = "codeblue.soundEnabled";
const MASTER_VOLUME = 0.35;

interface AudioEngine {
  context: AudioContext;
  output: GainNode;
  noise: AudioBuffer;
}

let engine: AudioEngine | null = null;
let resumePromise: Promise<void> | null = null;
let trustedInteractionSeen = false;
let soundEnabled: boolean | undefined;
const preferenceListeners = new Set<() => void>();

/** Böngésző- vagy tárolóhiba esetén is használható marad a játék. */
export function getSoundEnabled(): boolean {
  if (soundEnabled === undefined) {
    try {
      soundEnabled =
        typeof window === "undefined" ||
        window.localStorage.getItem(SOUND_PREFERENCE_KEY) !== "false";
    } catch {
      soundEnabled = true;
    }
  }
  return soundEnabled;
}

export function setSoundEnabled(enabled: boolean): void {
  soundEnabled = enabled;
  try {
    window.localStorage.setItem(SOUND_PREFERENCE_KEY, String(enabled));
  } catch {
    // Privát böngészésben a beállítás csak az aktuális lapra érvényes.
  }
  try {
    if (engine) {
      engine.output.gain.setTargetAtTime(
        enabled ? MASTER_VOLUME : 0,
        engine.context.currentTime,
        0.015,
      );
    }
  } catch {
    // A hang hiánya nem akadályozhatja a játékmenetet.
  }
  preferenceListeners.forEach((listener) => listener());
}

export function subscribeSoundEnabled(listener: () => void): () => void {
  preferenceListeners.add(listener);
  return () => {
    preferenceListeners.delete(listener);
  };
}

function getEngine(): AudioEngine | null {
  if (engine) return engine.context.state === "closed" ? null : engine;
  if (typeof window === "undefined") return null;

  try {
    const AudioContextClass =
      window.AudioContext ??
      (window as Window & { webkitAudioContext?: typeof AudioContext })
        .webkitAudioContext;
    if (!AudioContextClass) return null;

    const context = new AudioContextClass();
    const output = context.createGain();
    output.gain.value = getSoundEnabled() ? MASTER_VOLUME : 0;
    output.connect(context.destination);

    // Egy rövid, újrahasznált zajminta adja a dobás és a lapozás textúráját.
    const noise = context.createBuffer(
      1,
      Math.ceil(context.sampleRate * 0.4),
      context.sampleRate,
    );
    const samples = noise.getChannelData(0);
    for (let index = 0; index < samples.length; index += 1) {
      samples[index] = Math.random() * 2 - 1;
    }

    engine = { context, output, noise };
    return engine;
  } catch {
    return null;
  }
}

/** A felhasználó első valódi interakciójának eseménykezelőjéből hívható. */
export async function unlockAudio(): Promise<void> {
  try {
    const audio = getEngine();
    if (!audio || audio.context.state === "running") return;
    if (!resumePromise) {
      resumePromise = audio.context
        .resume()
        .catch(() => undefined)
        .finally(() => {
          resumePromise = null;
        });
    }
    await resumePromise;
  } catch {
    // A böngésző letilthatja a hangot; ilyenkor csendben folytatjuk.
  }
}

/** A capture fázisban feloldjuk a hangot a React kattintáskezelői előtt. */
export function registerAudioUnlock(): () => void {
  if (typeof document === "undefined") return () => undefined;

  const onInteraction = (event: Event) => {
    if (!event.isTrusted) return;
    trustedInteractionSeen = true;
    void unlockAudio();
  };
  const events = ["pointerdown", "keydown", "touchstart"] as const;
  events.forEach((event) =>
    document.addEventListener(event, onInteraction, {
      capture: true,
      passive: true,
    }),
  );

  return () => {
    events.forEach((event) =>
      document.removeEventListener(event, onInteraction, true),
    );
  };
}

function tone(
  audio: AudioEngine,
  start: number,
  frequency: number,
  duration: number,
  volume: number,
  type: OscillatorType = "sine",
): void {
  const oscillator = audio.context.createOscillator();
  const envelope = audio.context.createGain();
  oscillator.type = type;
  oscillator.frequency.setValueAtTime(frequency, start);
  envelope.gain.setValueAtTime(0.0001, start);
  envelope.gain.exponentialRampToValueAtTime(volume, start + 0.008);
  envelope.gain.exponentialRampToValueAtTime(0.0001, start + duration);
  oscillator.connect(envelope);
  envelope.connect(audio.output);
  oscillator.onended = () => {
    oscillator.disconnect();
    envelope.disconnect();
  };
  oscillator.start(start);
  oscillator.stop(start + duration);
}

function noiseBurst(
  audio: AudioEngine,
  start: number,
  duration: number,
  volume: number,
  fromFrequency: number,
  toFrequency: number,
): void {
  const source = audio.context.createBufferSource();
  const filter = audio.context.createBiquadFilter();
  const envelope = audio.context.createGain();
  source.buffer = audio.noise;
  filter.type = "bandpass";
  filter.Q.value = 0.7;
  filter.frequency.setValueAtTime(fromFrequency, start);
  filter.frequency.exponentialRampToValueAtTime(toFrequency, start + duration);
  envelope.gain.setValueAtTime(0.0001, start);
  envelope.gain.exponentialRampToValueAtTime(
    volume,
    start + Math.min(0.025, duration / 3),
  );
  envelope.gain.exponentialRampToValueAtTime(0.0001, start + duration);
  source.connect(filter);
  filter.connect(envelope);
  envelope.connect(audio.output);
  source.onended = () => {
    source.disconnect();
    filter.disconnect();
    envelope.disconnect();
  };
  source.start(start);
  source.stop(start + duration);
}

function synthesize(audio: AudioEngine, effect: SoundEffect): void {
  const start = audio.context.currentTime + 0.005;

  switch (effect) {
    case "dice":
      [0, 0.045, 0.095, 0.15, 0.21, 0.28, 0.35].forEach((offset, index) => {
        noiseBurst(
          audio,
          start + offset,
          0.035,
          0.55 - index * 0.045,
          2_400,
          500,
        );
        tone(audio, start + offset, 160 + index * 21, 0.05, 0.12, "triangle");
      });
      break;
    case "money":
      [1_046.5, 1_318.51, 1_567.98].forEach((frequency, index) => {
        tone(audio, start + index * 0.07, frequency, 0.3, 0.28);
        tone(audio, start + index * 0.07, frequency * 2, 0.13, 0.06);
      });
      break;
    case "penalty":
      // Enyhe tompa koppanás és lefelé lépdelő mélyebb hangok a kiadásokhoz / bírságokhoz.
      noiseBurst(audio, start, 0.08, 0.35, 500, 120);
      [
        { offset: 0, freq: 311.13, duration: 0.12, volume: 0.22 },
        { offset: 0.09, freq: 261.63, duration: 0.12, volume: 0.22 },
        { offset: 0.18, freq: 196.0, duration: 0.28, volume: 0.25 },
      ].forEach(({ offset, freq, duration, volume }) => {
        tone(audio, start + offset, freq, duration, volume, "triangle");
      });
      break;
    case "build":
      // Ünnepélyes klinikai átadás: strukturális koppanás + fényes C-dúr akkordbontás.
      noiseBurst(audio, start, 0.04, 0.35, 1_200, 300);
      tone(audio, start, 440, 0.05, 0.15, "triangle");
      [523.25, 659.25, 783.99, 1_046.5].forEach((frequency, index) => {
        const offset = [0.05, 0.11, 0.17, 0.24][index];
        const duration = [0.2, 0.2, 0.25, 0.4][index];
        const volume = [0.2, 0.22, 0.24, 0.28][index];
        tone(audio, start + offset, frequency, duration, volume, "sine");
      });
      break;
    case "siren":
      // Kétciklusos európai mentősziréna váltókürt (A4 440Hz -> E4 330Hz).
      [
        { offset: 0, freq: 440, duration: 0.15 },
        { offset: 0.16, freq: 330, duration: 0.15 },
        { offset: 0.32, freq: 440, duration: 0.15 },
        { offset: 0.48, freq: 330, duration: 0.25 },
      ].forEach(({ offset, freq, duration }) => {
        tone(audio, start + offset, freq, duration, 0.22, "triangle");
      });
      break;
    case "card":
      noiseBurst(audio, start, 0.25, 0.65, 600, 4_000);
      noiseBurst(audio, start + 0.08, 0.17, 0.3, 3_000, 300);
      break;
    case "victory":
      [523.25, 659.25, 783.99, 1_046.5, 783.99, 1_046.5].forEach(
        (frequency, index) => {
          const offset = [0, 0.12, 0.24, 0.4, 0.62, 0.8][index];
          tone(
            audio,
            start + offset,
            frequency,
            index === 5 ? 0.65 : 0.21,
            0.24,
            "triangle",
          );
        },
      );
      [523.25, 659.25, 783.99].forEach((frequency) => {
        tone(audio, start + 0.8, frequency, 0.75, 0.13);
      });
      break;
  }
}

/** Minden hang helyben készül; nincs letöltés vagy külső hangfájl. */
export async function playSound(effect: SoundEffect): Promise<void> {
  if (!getSoundEnabled()) return;
  try {
    const audio = getEngine();
    if (!audio) return;
    if (audio.context.state !== "running") {
      // Nem várakoztatunk oldalbetöltéskor keletkezett hangokat a későbbi kattintásig.
      if (!trustedInteractionSeen) return;
      await unlockAudio();
    }
    if (!getSoundEnabled() || audio.context.state !== "running") return;
    synthesize(audio, effect);
  } catch {
    // A hang opcionális: egy hibás vagy nem támogatott audioeszköz sem állítja meg a játékot.
  }
}
