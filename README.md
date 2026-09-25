# Matematikos nuotykiai

Arithmetic practice game for kids, with a per-preset leaderboard.

## Run locally

Requires Node ≥ 22.18.

```bash
npm ci
npm run server   # terminal 1: leaderboard API on http://localhost:3001
npm run dev      # terminal 2: app on http://localhost:5173 (proxies /api to :3001)
```

Open http://localhost:5173.

## Other scripts

| Command | What it does |
| --- | --- |
| `npm test` | Run the Vitest suite |
| `npm run lint` | Lint with oxlint |
| `npm run build` | Type-check and build into `dist/` |
| `npm start` | Build, then serve the app and API together on port 3001 (`PORT` overrides it) |

## Deploy

`docker compose up -d --build` runs the app behind Caddy (`deploy/Caddyfile`).
Leaderboard data is kept in the `leaderboard-data` volume.
