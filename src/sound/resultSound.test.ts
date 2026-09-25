import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// Stand-ins for the downloaded bytes and the decoded audio, each remembering which file it came from.
interface FakeFile {
  url: string;
}

interface FakeBuffer {
  decodedFrom: string;
}

// Just enough of the Web Audio API to record what gets played; jsdom has none.
class FakeBufferSource {
  buffer: FakeBuffer | null = null;
  target: unknown = null;
  started = false;
  connect<T>(target: T): T {
    this.target = target;
    return target;
  }
  start() {
    this.started = true;
  }
}

class FakeAudioContext {
  static instances: FakeAudioContext[] = [];
  static initialState = 'running';
  static decodeFails = false;

  state = FakeAudioContext.initialState;
  destination = { name: 'speakers' };
  sources: FakeBufferSource[] = [];
  decoded: string[] = [];
  resume = vi.fn(() => Promise.resolve());

  constructor() {
    FakeAudioContext.instances.push(this);
  }
  createBufferSource() {
    const source = new FakeBufferSource();
    this.sources.push(source);
    return source;
  }
  // Older Safari only has the callback form, so that is the one the module uses.
  decodeAudioData(
    data: FakeFile,
    onSuccess: (buffer: FakeBuffer) => void,
    onError: (error: Error) => void
  ) {
    this.decoded.push(data.url);
    if (FakeAudioContext.decodeFails) onError(new Error('EncodingError'));
    else onSuccess({ decodedFrom: data.url });
  }
}

const fetchMock = vi.fn(async (url: string) => ({
  ok: true,
  status: 200,
  arrayBuffer: async (): Promise<FakeFile> => ({ url }),
}));

// A fresh module per test, so its cached AudioContext and sounds never leak between tests.
async function loadSound() {
  vi.resetModules();
  return import('./resultSound');
}

// Downloading and decoding are chains of promises; let them all run.
function settle() {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

function played(ctx: FakeAudioContext) {
  return ctx.sources.filter((source) => source.started).map((source) => source.buffer?.decodedFrom);
}

function fetchedUrls() {
  return fetchMock.mock.calls.map(([url]) => url);
}

beforeEach(() => {
  FakeAudioContext.instances = [];
  FakeAudioContext.initialState = 'running';
  FakeAudioContext.decodeFails = false;
  fetchMock.mockClear();
  vi.stubGlobal('fetch', fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('playResultSound', () => {
  it('plays the success recording through the speakers for a correct answer', async () => {
    vi.stubGlobal('AudioContext', FakeAudioContext);
    const { playResultSound } = await loadSound();

    playResultSound(true);
    await settle();

    const [ctx] = FakeAudioContext.instances;
    expect(played(ctx)).toEqual([expect.stringMatching(/success\.mp3$/)]);
    expect(ctx.sources[0].target).toBe(ctx.destination);
  });

  it('plays the fail recording for a wrong answer', async () => {
    vi.stubGlobal('AudioContext', FakeAudioContext);
    const { playResultSound } = await loadSound();

    playResultSound(false);
    await settle();

    const [ctx] = FakeAudioContext.instances;
    expect(played(ctx)).toEqual([expect.stringMatching(/fail\.mp3$/)]);
  });

  it('downloads and decodes each recording once, then replays it every round', async () => {
    vi.stubGlobal('AudioContext', FakeAudioContext);
    const { playResultSound } = await loadSound();

    for (const isCorrect of [true, false, true, false]) {
      playResultSound(isCorrect);
      await settle();
    }

    const [ctx] = FakeAudioContext.instances;
    expect(played(ctx)).toHaveLength(4);
    expect(fetchedUrls()).toHaveLength(2);
    expect(ctx.decoded).toHaveLength(2);
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
    await settle();

    expect(played(FakeAudioContext.instances[0])).toHaveLength(1);
  });

  it('stays silent, and tries the download again next round, when it fails', async () => {
    vi.stubGlobal('AudioContext', FakeAudioContext);
    const { playResultSound } = await loadSound();
    fetchMock.mockRejectedValueOnce(new Error('offline'));

    playResultSound(false);
    await settle();
    const [ctx] = FakeAudioContext.instances;
    expect(played(ctx)).toEqual([]);

    playResultSound(false);
    await settle();
    expect(played(ctx)).toEqual([expect.stringMatching(/fail\.mp3$/)]);
    expect(fetchedUrls()).toHaveLength(2);
  });

  it('stays silent when the server answers the download with an error', async () => {
    vi.stubGlobal('AudioContext', FakeAudioContext);
    const { playResultSound } = await loadSound();
    fetchMock.mockResolvedValueOnce({
      ok: false,
      status: 404,
      arrayBuffer: async () => ({ url: 'not found page' }),
    });

    playResultSound(true);
    await settle();

    const [ctx] = FakeAudioContext.instances;
    expect(ctx.decoded).toEqual([]);
    expect(played(ctx)).toEqual([]);
  });

  it('stays silent when the recording cannot be decoded', async () => {
    FakeAudioContext.decodeFails = true;
    vi.stubGlobal('AudioContext', FakeAudioContext);
    const { playResultSound } = await loadSound();

    playResultSound(true);
    await settle();

    expect(played(FakeAudioContext.instances[0])).toEqual([]);
  });

  it('stays silent without breaking the game when the browser has no Web Audio', async () => {
    vi.stubGlobal('AudioContext', undefined);
    const { playResultSound } = await loadSound();

    expect(() => playResultSound(true)).not.toThrow();
    expect(() => playResultSound(false)).not.toThrow();
    expect(fetchMock).not.toHaveBeenCalled();
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

describe('preloadResultSounds', () => {
  it('downloads and decodes both recordings without playing anything', async () => {
    vi.stubGlobal('AudioContext', FakeAudioContext);
    const { preloadResultSounds } = await loadSound();

    preloadResultSounds();
    await settle();

    const [ctx] = FakeAudioContext.instances;
    expect(fetchedUrls()).toEqual([
      expect.stringMatching(/success\.mp3$/),
      expect.stringMatching(/fail\.mp3$/),
    ]);
    expect(ctx.decoded).toHaveLength(2);
    expect(played(ctx)).toEqual([]);
  });

  it('lets the result sound play without downloading it again', async () => {
    vi.stubGlobal('AudioContext', FakeAudioContext);
    const { preloadResultSounds, playResultSound } = await loadSound();

    preloadResultSounds();
    await settle();
    preloadResultSounds();
    playResultSound(true);
    await settle();

    expect(fetchedUrls()).toHaveLength(2);
    expect(played(FakeAudioContext.instances[0])).toEqual([expect.stringMatching(/success\.mp3$/)]);
  });

  it('wakes up a suspended audio context', async () => {
    FakeAudioContext.initialState = 'suspended';
    vi.stubGlobal('AudioContext', FakeAudioContext);
    const { preloadResultSounds } = await loadSound();

    preloadResultSounds();

    expect(FakeAudioContext.instances[0].resume).toHaveBeenCalled();
  });

  it('does nothing without breaking the game when the browser has no Web Audio', async () => {
    vi.stubGlobal('AudioContext', undefined);
    const { preloadResultSounds } = await loadSound();

    expect(() => preloadResultSounds()).not.toThrow();
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
