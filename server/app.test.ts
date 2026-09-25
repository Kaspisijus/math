// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { mkdtemp, readFile, rm, writeFile, mkdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { AddressInfo } from 'node:net';
import type { Server } from 'node:http';
import { createApp, type AppOptions } from './app.ts';

let dir: string;
let dataFile: string;
const servers: Server[] = [];

async function start(options: Partial<AppOptions> = {}) {
  let clock = 1000;
  const server = createApp({ dataFile, now: () => clock++, ...options });
  servers.push(server);
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const { port } = server.address() as AddressInfo;
  return `http://127.0.0.1:${port}`;
}

interface BoardBody {
  entries: { name: string; points: number }[];
  rank?: number;
  total?: number;
  improved?: boolean;
}

async function json(res: Response | Promise<Response>): Promise<BoardBody> {
  return (await (await res).json()) as BoardBody;
}

function post(base: string, path: string, body: unknown) {
  return fetch(`${base}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  });
}

beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), 'leaderboard-test-'));
  dataFile = join(dir, 'data', 'leaderboard.json');
});

afterEach(async () => {
  await Promise.all(servers.splice(0).map((s) => new Promise((r) => s.close(r))));
  await rm(dir, { recursive: true, force: true });
});

describe('leaderboard API', () => {
  it('returns an empty board for a known preset', async () => {
    const base = await start();
    const res = await fetch(`${base}/api/leaderboard/ant`);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ entries: [] });
  });

  it('stores a score and reports rank, total and best', async () => {
    const base = await start();
    await post(base, '/api/leaderboard/ant', { name: 'Tėtis', points: 30 });
    const res = await post(base, '/api/leaderboard/ant', { name: 'Ona', points: 20 });

    expect(res.status).toBe(200);
    const body = await json(res);
    expect(body).toMatchObject({ rank: 2, total: 2, improved: true, best: { name: 'Ona', points: 20 } });
    expect(body.entries.map((e) => e.name)).toEqual(['Tėtis', 'Ona']);

    const board = await json(fetch(`${base}/api/leaderboard/ant`));
    expect(board.entries).toHaveLength(2);
  });

  it('keeps the best score and reports improved=false for a lower one', async () => {
    const base = await start();
    await post(base, '/api/leaderboard/wizard', { name: 'Ona', points: 20 });
    const body = await json(post(base, '/api/leaderboard/wizard', { name: 'ona', points: 5 }));
    expect(body).toMatchObject({ improved: false, rank: 1, best: { name: 'Ona', points: 20 } });
  });

  it('keeps boards separate per preset', async () => {
    const base = await start();
    await post(base, '/api/leaderboard/ant', { name: 'Ona', points: 20 });
    const elephant = await json(fetch(`${base}/api/leaderboard/elephant`));
    expect(elephant.entries).toEqual([]);
  });

  it('returns only the top 10 entries but ranks against everyone', async () => {
    const base = await start();
    for (let i = 1; i <= 12; i++) {
      await post(base, '/api/leaderboard/ant', { name: `P${i}`, points: 100 - i });
    }
    const body = await json(post(base, '/api/leaderboard/ant', { name: 'Last', points: 1 }));
    expect(body.entries).toHaveLength(10);
    expect(body).toMatchObject({ rank: 13, total: 13 });
  });

  it('rejects invalid submissions with 400', async () => {
    const base = await start();
    expect((await post(base, '/api/leaderboard/ant', { name: '', points: 5 })).status).toBe(400);
    expect((await post(base, '/api/leaderboard/ant', { name: 'Ona', points: 0 })).status).toBe(400);
    expect((await post(base, '/api/leaderboard/ant', '{not json')).status).toBe(400);
  });

  it('rejects oversized bodies with 413', async () => {
    const base = await start();
    const res = await post(base, '/api/leaderboard/ant', { name: 'x'.repeat(2000), points: 5 });
    expect(res.status).toBe(413);
  });

  it('returns 404 for unknown presets and routes', async () => {
    const base = await start();
    expect((await fetch(`${base}/api/leaderboard/custom`)).status).toBe(404);
    expect((await fetch(`${base}/api/nope`)).status).toBe(404);
  });

  it('persists scores so a restarted server still has them', async () => {
    const first = await start();
    await post(first, '/api/leaderboard/elephant', { name: 'Ona', points: 42 });

    const saved = JSON.parse(await readFile(dataFile, 'utf8'));
    expect(saved.elephant[0]).toMatchObject({ name: 'Ona', points: 42 });

    const second = await start();
    const board = await json(fetch(`${second}/api/leaderboard/elephant`));
    expect(board.entries[0]).toMatchObject({ name: 'Ona', points: 42 });
  });

  it('serves the built app with an index.html fallback when staticDir is set', async () => {
    const staticDir = join(dir, 'dist');
    await mkdir(join(staticDir, 'assets'), { recursive: true });
    await writeFile(join(staticDir, 'index.html'), '<h1>app</h1>');
    await writeFile(join(staticDir, 'assets', 'a.js'), 'console.log(1)');
    const base = await start({ staticDir });

    const asset = await fetch(`${base}/assets/a.js`);
    expect(asset.headers.get('content-type')).toContain('text/javascript');
    expect(await asset.text()).toBe('console.log(1)');
    expect(await (await fetch(`${base}/some/route`)).text()).toBe('<h1>app</h1>');
    expect((await fetch(`${base}/..%2f..%2fsecret`)).status).toBe(404);
  });

  it('serves the result sounds as audio', async () => {
    const staticDir = join(dir, 'dist');
    await mkdir(join(staticDir, 'assets'), { recursive: true });
    await writeFile(join(staticDir, 'index.html'), '<h1>app</h1>');
    await writeFile(join(staticDir, 'assets', 'success.mp3'), Buffer.from([0xff, 0xfb, 0x90]));
    const base = await start({ staticDir });

    const sound = await fetch(`${base}/assets/success.mp3`);
    expect(sound.headers.get('content-type')).toBe('audio/mpeg');
    expect(new Uint8Array(await sound.arrayBuffer())).toEqual(new Uint8Array([0xff, 0xfb, 0x90]));
  });
});
