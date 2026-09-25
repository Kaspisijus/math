import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http';
import { existsSync, readFileSync } from 'node:fs';
import { mkdir, readFile, rename, stat, writeFile } from 'node:fs/promises';
import { dirname, extname, join, resolve, sep } from 'node:path';
import {
  TOP_N,
  emptyBoards,
  findEntry,
  isPresetId,
  rankOf,
  upsertBest,
  validateSubmission,
  type Boards,
} from './leaderboard.ts';

export interface AppOptions {
  dataFile: string;
  staticDir?: string;
  now?: () => number;
}

const MAX_BODY_BYTES = 1024;

const CONTENT_TYPES: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.json': 'application/json',
  '.mp3': 'audio/mpeg',
};

class HttpError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

function loadBoards(dataFile: string): Boards {
  const boards = emptyBoards();
  if (!existsSync(dataFile)) return boards;
  // A corrupt file throws here on purpose: starting empty would overwrite the scores on the next save.
  const saved = JSON.parse(readFileSync(dataFile, 'utf8')) as Partial<Boards>;
  for (const id of Object.keys(boards) as (keyof Boards)[]) {
    if (Array.isArray(saved[id])) boards[id] = saved[id];
  }
  return boards;
}

function sendJson(res: ServerResponse, status: number, body: unknown) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(body));
}

async function readJsonBody(req: IncomingMessage): Promise<unknown> {
  let size = 0;
  const chunks: Buffer[] = [];
  for await (const chunk of req) {
    size += (chunk as Buffer).length;
    if (size > MAX_BODY_BYTES) throw new HttpError(413, 'Body too large');
    chunks.push(chunk as Buffer);
  }
  try {
    return JSON.parse(Buffer.concat(chunks).toString('utf8'));
  } catch {
    throw new HttpError(400, 'Invalid JSON');
  }
}

async function serveStatic(staticDir: string, pathname: string, res: ServerResponse) {
  const root = resolve(staticDir);
  let filePath = resolve(root, '.' + decodeURIComponent(pathname));
  if (filePath !== root && !filePath.startsWith(root + sep)) {
    throw new HttpError(404, 'Not found');
  }

  const isFile = await stat(filePath).then((s) => s.isFile(), () => false);
  if (!isFile) filePath = join(root, 'index.html');

  const content = await readFile(filePath);
  res.writeHead(200, {
    'Content-Type': CONTENT_TYPES[extname(filePath)] ?? 'application/octet-stream',
  });
  res.end(content);
}

export function createApp({ dataFile, staticDir, now = Date.now }: AppOptions): Server {
  const boards = loadBoards(dataFile);
  let writeQueue: Promise<void> = Promise.resolve();

  function persist(): Promise<void> {
    writeQueue = writeQueue.then(async () => {
      await mkdir(dirname(dataFile), { recursive: true });
      const tmp = `${dataFile}.tmp`;
      await writeFile(tmp, JSON.stringify(boards, null, 2));
      await rename(tmp, dataFile);
    });
    return writeQueue;
  }

  async function handle(req: IncomingMessage, res: ServerResponse) {
    const { pathname } = new URL(req.url ?? '/', 'http://localhost');
    const match = /^\/api\/leaderboard\/([^/]+)$/.exec(pathname);

    if (match) {
      const presetId = match[1];
      if (!isPresetId(presetId)) throw new HttpError(404, 'Unknown preset');

      if (req.method === 'GET') {
        sendJson(res, 200, { entries: boards[presetId].slice(0, TOP_N) });
        return;
      }

      if (req.method === 'POST') {
        const submission = validateSubmission(await readJsonBody(req));
        if (typeof submission === 'string') throw new HttpError(400, submission);

        const { entries, improved } = upsertBest(
          boards[presetId],
          submission.name,
          submission.points,
          now()
        );
        boards[presetId] = entries;
        if (improved) await persist();

        sendJson(res, 200, {
          entries: entries.slice(0, TOP_N),
          rank: rankOf(entries, submission.name),
          total: entries.length,
          improved,
          best: findEntry(entries, submission.name),
        });
        return;
      }

      throw new HttpError(405, 'Method not allowed');
    }

    if (pathname.startsWith('/api/')) throw new HttpError(404, 'Not found');

    if (staticDir && req.method === 'GET') {
      await serveStatic(staticDir, pathname, res);
      return;
    }

    throw new HttpError(404, 'Not found');
  }

  return createServer((req, res) => {
    handle(req, res).catch((err: unknown) => {
      const status = err instanceof HttpError ? err.status : 500;
      const message = err instanceof HttpError ? err.message : 'Internal error';
      if (status === 500) console.error(err);
      if (!res.headersSent) sendJson(res, status, { error: message });
      else res.end();
    });
  });
}
