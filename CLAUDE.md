# Matematikos nuotykiai

Kids' arithmetic practice app (UI in Lithuanian). React 19 + Vite frontend in `src/`,
a small dependency-free Node HTTP server in `server/` that stores the leaderboard.

## Starting the app (dev)

1. `npm ci` — **required on a fresh checkout**; without it `npm run dev` fails with
   `'vite' is not recognized`.
2. Start **both** processes. In the Claude desktop app, use `preview_start` with the
   configs in `.claude/launch.json`, starting the server first:
   - `math-server` → `npm run server` (API on http://localhost:3001)
   - `math-dev` → `npm run dev` (UI on http://localhost:5173)

The Vite dev server proxies `/api` to `:3001` (`vite.config.ts`). If only `math-dev`
is running, the UI still loads but API calls return 502 and the leaderboard shows
"Lyderių lentelė dabar nepasiekiama". A 502 or two right after startup is just a
race between the two processes; reload the page.

Smoke check: `curl http://localhost:5173/api/leaderboard/ant` → `{"entries":[]}`.
`/api/leaderboard` with no preset returns 404, which is expected.

## Other commands

- `npm test` — Vitest (jsdom). Frontend tests sit next to components (`*.test.tsx`);
  server tests are in `server/app.test.ts`.
- `npm run lint` — oxlint
- `npm run build` — `tsc -b && vite build` into `dist/`
- `npm start` — production-style: builds, then `node server/index.ts --static` serves
  `dist/` and the API together on port 3001 (`PORT` env var overrides it).

## Notes

- Rounds are a running total. `src/logic/generateStep.ts` picks each step from the round's
  history. The first step is always `+` (a round that opened with × / ÷ would stay at 0), and
  the least-used enabled op goes next. With X as the × / ÷ max, those steps are dealt 1 in X
  against 0, 1 in X against 1, and the rest with normal numbers. When × / ÷ can't go from the
  current total, a +/− step moves the total to where it can.

- Node runs `server/*.ts` directly through native type stripping, so use Node ≥ 22.18
  (developed on 24). The server has no build step.
- Leaderboard data lives in `server/data/leaderboard.json` (gitignored, created on first write).
- Deployment: `Dockerfile` + `docker-compose.yml` (app + Caddy, `deploy/Caddyfile`),
  run from `.github/workflows`.
