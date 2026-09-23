import { fileURLToPath } from 'node:url';
import { createApp } from './app.ts';

const port = Number(process.env.PORT ?? 3001);
const serveStatic = process.argv.includes('--static');

const app = createApp({
  dataFile: fileURLToPath(new URL('./data/leaderboard.json', import.meta.url)),
  staticDir: serveStatic ? fileURLToPath(new URL('../dist', import.meta.url)) : undefined,
});

app.listen(port, '0.0.0.0', () => {
  console.log(`Leaderboard server on http://localhost:${port}${serveStatic ? ' (serving app)' : ''}`);
});
