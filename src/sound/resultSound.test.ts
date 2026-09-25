import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// Just enough of the Web Audio API to record what gets scheduled; jsdom has none.
class FakeParam {
  scheduled: number[] = [];
  setValueAtTime(value: number) {
    this.scheduled.push(value);
    return this;
  }
  linearRampToValueAtTime() {
    return this;
  }
  exponentialRampToValueAtTime() {
    return this;
  }
}

class FakeNode {
  target: unknown = null;
  connect<T>(target: T): T {
    this.target = target;
    return target;
  }
}

class FakeOscillator extends FakeNode {
  type = 'sine';
  frequency = new FakeParam();
  startedAt: number | null = null;
  start(when: number) {
    this.startedAt = when;
  }
  stop() {}
}

class FakeGain extends FakeNode {
  gain = new FakeParam();
}

class FakeFilter extends FakeNode {
  type = 'lowpass';
  frequency = new FakeParam();
  Q = new FakeParam();
}

class FakeAudioContext {
  static instances: FakeAudioContext[] = [];
  static initialState = 'running';

  currentTime = 10;
  state = FakeAudioContext.initialState;
  destination = { name: 'speakers' };
  oscillators: FakeOscillator[] = [];
  filters: FakeFilter[] = [];
  resume = vi.fn(() => Promise.resolve());

  constructor() {
    FakeAudioContext.instances.push(this);
  }
  createOscillator() {
    const osc = new FakeOscillator();
    this.oscillators.push(osc);
    return osc;
  }
  createGain() {
    return new FakeGain();
  }
  createBiquadFilter() {
    const filter = new FakeFilter();
    this.filters.push(filter);
    return filter;
  }
}

// A fresh module per test, so its cached AudioContext never leaks between tests.
async function loadSound() {
  vi.resetModules();
  return import('./resultSound');
}

function notesOf(ctx: FakeAudioContext, type: string) {
  const notes = ctx.oscillators.filter((osc) => osc.type === type);
  return {
    notes,
    frequencies: notes.map((osc) => osc.frequency.scheduled[0]),
    starts: notes.map((osc) => osc.startedAt as number),
  };
}

function isIncreasing(values: number[]) {
  return values.every((value, i) => i === 0 || value > values[i - 1]);
}

beforeEach(() => {
  FakeAudioContext.instances = [];
  FakeAudioContext.initialState = 'running';
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('playResultSound', () => {
  it('plays a rising arpeggio for a correct answer', async () => {
    vi.stubGlobal('AudioContext', FakeAudioContext);
    const { playResultSound, SUCCESS_NOTES } = await loadSound();

    playResultSound(true);

    const [ctx] = FakeAudioContext.instances;
    const { frequencies, starts } = notesOf(ctx, 'triangle');
    expect(frequencies).toEqual(SUCCESS_NOTES.map((note) => note.frequency));
    expect(isIncreasing(frequencies)).toBe(true);
    expect(starts[0]).toBeGreaterThanOrEqual(ctx.currentTime);
    expect(isIncreasing(starts)).toBe(true);
    expect(ctx.filters).toHaveLength(0);
  });

  it('plays a falling, muffled sad trombone with a wobbling last note for a wrong answer', async () => {
    vi.stubGlobal('AudioContext', FakeAudioContext);
    const { playResultSound, FAIL_NOTES } = await loadSound();

    playResultSound(false);

    const [ctx] = FakeAudioContext.instances;
    const { notes, frequencies, starts } = notesOf(ctx, 'sawtooth');
    expect(frequencies).toEqual(FAIL_NOTES.map((note) => note.frequency));
    expect(isIncreasing([...frequencies].reverse())).toBe(true);
    expect(isIncreasing(starts)).toBe(true);

    expect(ctx.filters.map((filter) => filter.type)).toEqual(['lowpass']);
    expect(ctx.filters[0].target).toBe(ctx.destination);

    // The wobble: a slow sine oscillator, through a depth gain, bends the last note's pitch.
    const lastNote = notes[notes.length - 1];
    const [lfo] = ctx.oscillators.filter((osc) => osc.type === 'sine');
    expect(lfo.frequency.scheduled[0]).toBeLessThan(20);
    expect((lfo.target as FakeGain).target).toBe(lastNote.frequency);
  });

  it('reuses one audio context across rounds', async () => {
    vi.stubGlobal('AudioContext', FakeAudioContext);
    const { playResultSound } = await loadSound();

    playResultSound(true);
    playResultSound(false);

    expect(FakeAudioContext.instances).toHaveLength(1);
  });

  it('wakes up a suspended audio context before playing', async () => {
    FakeAudioContext.initialState = 'suspended';
    vi.stubGlobal('AudioContext', FakeAudioContext);
    const { playResultSound } = await loadSound();

    playResultSound(true);

    expect(FakeAudioContext.instances[0].resume).toHaveBeenCalled();
  });

  it('falls back to the prefixed webkitAudioContext on older Safari', async () => {
    vi.stubGlobal('AudioContext', undefined);
    vi.stubGlobal('webkitAudioContext', FakeAudioContext);
    const { playResultSound } = await loadSound();

    playResultSound(true);

    expect(FakeAudioContext.instances).toHaveLength(1);
  });

  it('stays silent without breaking the game when the browser has no Web Audio', async () => {
    vi.stubGlobal('AudioContext', undefined);
    const { playResultSound } = await loadSound();

    expect(() => playResultSound(true)).not.toThrow();
    expect(() => playResultSound(false)).not.toThrow();
  });

  it('stays silent without breaking the game when audio fails to start', async () => {
    vi.stubGlobal(
      'AudioContext',
      class {
        constructor() {
          throw new Error('audio device unavailable');
        }
      }
    );
    const { playResultSound } = await loadSound();

    expect(() => playResultSound(false)).not.toThrow();
  });
});
