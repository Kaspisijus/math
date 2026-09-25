import failUrl from './fail.mp3';
import successUrl from './success.mp3';

type AudioContextConstructor = new () => AudioContext;

let context: AudioContext | null = null;
const sounds = new Map<string, Promise<AudioBuffer>>();

function getContext(): AudioContext | null {
  if (!context) {
    const Ctor =
      (globalThis as { AudioContext?: AudioContextConstructor }).AudioContext ??
      (globalThis as { webkitAudioContext?: AudioContextConstructor }).webkitAudioContext;
    if (!Ctor) return null;
    context = new Ctor();
  }
  // Browsers may suspend audio until the page has been interacted with.
  if (context.state === 'suspended') context.resume().catch(() => {});
  return context;
}

// Played through Web Audio rather than an <audio> element: Safari won't play an <audio> file
// from a server without Range support (ours has none), and iOS unlocks each <audio> element
// separately, so a fail sound first reached by a timeout would stay silent.
function loadSound(ctx: AudioContext, url: string): Promise<AudioBuffer> {
  let sound = sounds.get(url);
  if (!sound) {
    sound = fetch(url)
      .then((res) => {
        if (!res.ok) throw new Error(`Could not load ${url}: HTTP ${res.status}`);
        return res.arrayBuffer();
      })
      // The callback form, because older Safari's decodeAudioData returns no promise.
      .then((data) => new Promise<AudioBuffer>((resolve, reject) => {
        ctx.decodeAudioData(data, resolve, reject);
      }));
    // Forget a failed load, so the next round tries again.
    sound.catch(() => sounds.delete(url));
    sounds.set(url, sound);
  }
  return sound;
}

// Called when a round starts. That tap lets the browser switch audio on, and the files then have
// the whole round to download, so the result sound can play as soon as the answer is checked.
export function preloadResultSounds(): void {
  try {
    const ctx = getContext();
    if (!ctx) return;
    loadSound(ctx, successUrl);
    loadSound(ctx, failUrl);
  } catch {
    // Sound is a bonus; never let it break the game.
  }
}

export function playResultSound(isCorrect: boolean): void {
  try {
    const ctx = getContext();
    if (!ctx) return;
    loadSound(ctx, isCorrect ? successUrl : failUrl)
      .then((buffer) => {
        const source = ctx.createBufferSource();
        source.buffer = buffer;
        source.connect(ctx.destination);
        source.start();
      })
      .catch(() => {});
  } catch {
    // Sound is a bonus; never let it break the game.
  }
}
