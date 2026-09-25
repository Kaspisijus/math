interface Note {
  frequency: number;
  duration: number;
}

// Rising C-major arpeggio: a short, cheerful "ta-da".
export const SUCCESS_NOTES: readonly Note[] = [
  { frequency: 523.25, duration: 0.1 }, // C5
  { frequency: 659.25, duration: 0.1 }, // E5
  { frequency: 783.99, duration: 0.1 }, // G5
  { frequency: 1046.5, duration: 0.35 }, // C6
];

// Sad trombone: "wah, wah, wah, waaah" stepping down, the last note held and wobbling.
export const FAIL_NOTES: readonly Note[] = [
  { frequency: 392.0, duration: 0.35 }, // G4
  { frequency: 369.99, duration: 0.35 }, // F#4
  { frequency: 349.23, duration: 0.35 }, // F4
  { frequency: 329.63, duration: 1.0 }, // E4
];

const WOBBLE_RATE_HZ = 6;
const WOBBLE_DEPTH_HZ = 8;
const SILENT = 0.0001; // exponential ramps cannot reach 0

type AudioContextConstructor = new () => AudioContext;

let context: AudioContext | null = null;

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

function playNote(
  ctx: AudioContext,
  destination: AudioNode,
  type: OscillatorType,
  note: Note,
  startAt: number,
  volume: number
): OscillatorNode {
  const osc = ctx.createOscillator();
  const envelope = ctx.createGain();
  const endAt = startAt + note.duration;

  osc.type = type;
  osc.frequency.setValueAtTime(note.frequency, startAt);
  envelope.gain.setValueAtTime(SILENT, startAt);
  envelope.gain.exponentialRampToValueAtTime(volume, startAt + 0.02);
  envelope.gain.exponentialRampToValueAtTime(SILENT, endAt);

  osc.connect(envelope).connect(destination);
  osc.start(startAt);
  osc.stop(endAt + 0.05);
  return osc;
}

function playSuccess(ctx: AudioContext) {
  let startAt = ctx.currentTime;
  for (const note of SUCCESS_NOTES) {
    playNote(ctx, ctx.destination, 'triangle', note, startAt, 0.3);
    startAt += note.duration;
  }
}

function playFail(ctx: AudioContext) {
  // Taking the top off the sawtooth makes it sound more like a brass horn and less like a buzzer.
  const muffle = ctx.createBiquadFilter();
  muffle.type = 'lowpass';
  muffle.frequency.setValueAtTime(1200, ctx.currentTime);
  muffle.connect(ctx.destination);

  let startAt = ctx.currentTime;
  let lastNote: OscillatorNode | null = null;
  for (const note of FAIL_NOTES) {
    lastNote = playNote(ctx, muffle, 'sawtooth', note, startAt, 0.25);
    startAt += note.duration;
  }

  if (!lastNote) return;
  const last = FAIL_NOTES[FAIL_NOTES.length - 1];
  const lastStart = startAt - last.duration;
  const wobble = ctx.createOscillator();
  const depth = ctx.createGain();
  wobble.type = 'sine';
  wobble.frequency.setValueAtTime(WOBBLE_RATE_HZ, lastStart);
  depth.gain.setValueAtTime(WOBBLE_DEPTH_HZ, lastStart);
  wobble.connect(depth).connect(lastNote.frequency);
  wobble.start(lastStart);
  wobble.stop(startAt);
}

export function playResultSound(isCorrect: boolean): void {
  try {
    const ctx = getContext();
    if (!ctx) return;
    if (isCorrect) playSuccess(ctx);
    else playFail(ctx);
  } catch {
    // Sound is a bonus; never let it break the game.
  }
}
