import assert from 'node:assert/strict';
import { afterEach, test } from 'node:test';

const originalWindow = Object.getOwnPropertyDescriptor(globalThis, 'window');
const originalDocument = Object.getOwnPropertyDescriptor(globalThis, 'document');
let importNumber = 0;

afterEach(() => {
  if (originalWindow) Object.defineProperty(globalThis, 'window', originalWindow);
  else Reflect.deleteProperty(globalThis, 'window');
  if (originalDocument) Object.defineProperty(globalThis, 'document', originalDocument);
  else Reflect.deleteProperty(globalThis, 'document');
});

function loadAudio() {
  importNumber += 1;
  return import(`../src/utils/audio.ts?test=${importNumber}`) as Promise<typeof import('../src/utils/audio.ts')>;
}

function mockBrowser(options: { muted?: boolean; blockedStorage?: boolean; blockedResume?: boolean; unsupported?: boolean } = {}) {
  const storage = new Map<string, string>();
  if (options.muted) storage.set('codeblue.soundEnabled', 'false');
  const handlers = new Map<string, Set<(event: { isTrusted: boolean }) => void>>();
  const stats = { contexts: 0, resumes: 0, oscillators: 0, noiseBursts: 0, volume: 0 };

  const parameter = () => ({
    value: 0,
    setValueAtTime() {},
    exponentialRampToValueAtTime() {},
    setTargetAtTime(value: number) { stats.volume = value; },
  });
  const node = () => ({ connect() {}, disconnect() {} });

  class MockAudioContext {
    state = 'suspended';
    currentTime = 0;
    sampleRate = 48_000;
    destination = node();

    constructor() { stats.contexts += 1; }
    createGain() { return { ...node(), gain: parameter() }; }
    createBuffer(_channels: number, length: number) {
      return { getChannelData: () => new Float32Array(length) };
    }
    createOscillator() {
      return {
        ...node(), frequency: parameter(), type: 'sine',
        start() { stats.oscillators += 1; }, stop() {},
      };
    }
    createBufferSource() {
      return {
        ...node(), buffer: null,
        start() { stats.noiseBursts += 1; }, stop() {},
      };
    }
    createBiquadFilter() {
      return { ...node(), type: 'bandpass', Q: parameter(), frequency: parameter() };
    }
    async resume() {
      stats.resumes += 1;
      if (options.blockedResume) throw new Error('Audio device unavailable');
      this.state = 'running';
    }
  }

  Object.defineProperty(globalThis, 'window', {
    configurable: true,
    value: {
      AudioContext: options.unsupported ? undefined : MockAudioContext,
      get localStorage() {
        if (options.blockedStorage) throw new Error('Storage unavailable');
        return {
          getItem: (key: string) => storage.get(key) ?? null,
          setItem: (key: string, value: string) => storage.set(key, value),
        };
      },
    },
  });
  Object.defineProperty(globalThis, 'document', {
    configurable: true,
    value: {
      addEventListener(type: string, handler: (event: { isTrusted: boolean }) => void) {
        const listeners = handlers.get(type) ?? new Set();
        listeners.add(handler);
        handlers.set(type, listeners);
      },
      removeEventListener(type: string, handler: (event: { isTrusted: boolean }) => void) {
        handlers.get(type)?.delete(handler);
      },
    },
  });

  return {
    stats,
    storage,
    fire(type: string, isTrusted = true) {
      handlers.get(type)?.forEach((handler) => handler({ isTrusted }));
    },
  };
}

test('one lazy context, trusted interaction unlock, and seven distinct synthesized effects', async () => {
  const browser = mockBrowser();
  const audio = await loadAudio();
  const cleanup = audio.registerAudioUnlock();
  assert.equal(browser.stats.contexts, 0);
  browser.fire('pointerdown', false);
  assert.equal(browser.stats.contexts, 0);
  browser.fire('pointerdown');
  await audio.unlockAudio();
  assert.equal(browser.stats.contexts, 1);
  assert.equal(browser.stats.resumes, 1);

  await audio.playSound('dice');
  assert.equal(browser.stats.noiseBursts, 7);
  assert.equal(browser.stats.oscillators, 7);
  await audio.playSound('money');
  assert.equal(browser.stats.oscillators, 13);
  await audio.playSound('card');
  assert.equal(browser.stats.noiseBursts, 9);
  await audio.playSound('victory');
  assert.equal(browser.stats.oscillators, 22);

  // New procedural effects
  await audio.playSound('build');
  assert.equal(browser.stats.noiseBursts, 10);
  assert.equal(browser.stats.oscillators, 27);

  await audio.playSound('siren');
  assert.equal(browser.stats.noiseBursts, 10);
  assert.equal(browser.stats.oscillators, 31);

  await audio.playSound('penalty');
  assert.equal(browser.stats.noiseBursts, 11);
  assert.equal(browser.stats.oscillators, 34);

  browser.fire('keydown');
  assert.equal(browser.stats.contexts, 1);
  cleanup();
});

test('mute persists, notifies subscribers and immediately silences current audio', async () => {
  const browser = mockBrowser({ muted: true });
  const audio = await loadAudio();
  assert.equal(audio.getSoundEnabled(), false);
  await audio.playSound('money');
  assert.equal(browser.stats.contexts, 0);

  let notifications = 0;
  const unsubscribe = audio.subscribeSoundEnabled(() => { notifications += 1; });
  audio.setSoundEnabled(true);
  assert.equal(browser.storage.get('codeblue.soundEnabled'), 'true');
  await audio.unlockAudio();
  await audio.playSound('money');
  const oscillatorCount = browser.stats.oscillators;
  audio.setSoundEnabled(false);
  assert.equal(browser.stats.volume, 0);
  await audio.playSound('victory');
  assert.equal(browser.stats.oscillators, oscillatorCount);
  assert.equal(browser.storage.get('codeblue.soundEnabled'), 'false');
  assert.equal(notifications, 2);
  unsubscribe();
  audio.setSoundEnabled(true);
  assert.equal(notifications, 2);
});

test('sounds before an interaction are dropped instead of queued', async () => {
  const browser = mockBrowser();
  const audio = await loadAudio();
  await audio.playSound('victory');
  assert.equal(browser.stats.resumes, 0);
  assert.equal(browser.stats.oscillators, 0);
  const cleanup = audio.registerAudioUnlock();
  browser.fire('touchstart');
  await audio.unlockAudio();
  assert.equal(browser.stats.oscillators, 0);
  cleanup();
});

test('storage restrictions, missing Web Audio and failed device resume remain silent', async () => {
  mockBrowser({ blockedStorage: true, unsupported: true });
  const unsupported = await loadAudio();
  assert.equal(unsupported.getSoundEnabled(), true);
  assert.doesNotThrow(() => unsupported.setSoundEnabled(false));
  unsupported.setSoundEnabled(true);
  await assert.doesNotReject(unsupported.unlockAudio());
  await assert.doesNotReject(unsupported.playSound('card'));

  const browser = mockBrowser({ blockedResume: true });
  const blocked = await loadAudio();
  const cleanup = blocked.registerAudioUnlock();
  browser.fire('keydown');
  await assert.doesNotReject(blocked.unlockAudio());
  await assert.doesNotReject(blocked.playSound('dice'));
  assert.equal(browser.stats.oscillators, 0);
  assert.equal(browser.stats.noiseBursts, 0);
  cleanup();
});
