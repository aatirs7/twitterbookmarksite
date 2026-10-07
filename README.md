# Trove

Searchable, auto-tagged library of your X bookmarks. Two parts:

- **Trove Web** (this Next.js app): stores, indexes, tags and displays bookmarks.
- **Trove Sync** (`/extension`): an MV3 Chrome extension that reads bookmarks through your logged-in X session and sends them to Trove Web.

## Setup

1. Copy `.env.example` to `.env.local` and fill in `DATABASE_URL` (Neon), `TROVE_PASSWORD`, `SESSION_SECRET`, `CRON_SECRET`, and `ANTHROPIC_API_KEY`.
2. `pnpm install`
3. `pnpm db:migrate`
4. `pnpm dev` and sign in at http://localhost:3000 with `TROVE_PASSWORD`.
5. Settings, create an import token.

## Extension

- `pnpm ext:build:dev` builds against `http://localhost:3000`; `pnpm ext:build` uses `TROVE_URL`.
- Load `extension/dist` via chrome://extensions, Developer mode, Load unpacked.
- In the extension options paste the token, test the connection, then set `EXTENSION_ORIGIN` on the server to the origin it shows.
- Open https://x.com/i/bookmarks once so it can learn the request format, then click Sync new.

`pnpm build` also builds the extension and writes `public/trove-sync.zip` for the Settings download link.

## Deploy (Vercel)

Set `DATABASE_URL`, `TROVE_PASSWORD`, `SESSION_SECRET`, `CRON_SECRET`, `ANTHROPIC_API_KEY`, `TROVE_URL` (your deployment URL), and `EXTENSION_ORIGIN`. `vercel.json` registers the single hourly cron.

## Scripts

`pnpm test` (normalizer and query parser), `pnpm smoke` (ingest and search against the database with a throwaway user), `pnpm typecheck`, `pnpm lint`.
