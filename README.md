# Minutes — meeting analysis and follow-ups

A meeting analysis workspace for Kenneth, Lee and Jackson’s 14 October 2026 Zoom meeting. It incorporates the complete supplied transcript, the short meeting summary, and all three storybook PDFs.

## Run locally

Use Node 22.13 or newer (the `.nvmrc` selects 22.23.1):

```sh
nvm use
npm ci
npm run dev
```

Open the local URL printed by Vinext. `npm run build` produces the Sites Worker and client assets in `dist/`; `npm start` previews the production Worker. The Node version and dependency lockfile are pinned for this build.

## What it does

- Reconciles the short summary with all 2,661 timestamped transcript utterances, including the rollover into 15 October.
- Maps the complete conversation to 15 discussion segments.
- Tracks five summary actions, three transcript requests and four proposed follow-ups, with distinct evidence and status.
- Compares the original Chinese story with both Malay adaptations, with page references, rendered examples and direct PDF access.
- Provides editable owners, statuses, dates and notes, CSV exports, a text report, JSON backup/restore and an editable follow-up message. It does not send messages.
- Connects each signed-in visitor’s own Zoom account using user-managed OAuth, pages through available meetings and cloud recordings, and imports full cloud transcripts. See [Zoom setup](docs/ZOOM_SETUP.md) for the required app credentials and distribution setup.
- Caches meeting records, minutes, full transcripts, PDF extraction results, and analyses in browser DuckDB with OPFS persistence. Saved library supports local search, reopen, export, and clear. Each account has a separate database; completed transcripts can be cached in bulk.
- Extracts explicit next steps from additional structured TXT minutes and searches text in PDF references with PDF.js. New uploads and extraction results stay in the browser and are saved to the active DuckDB cache. This is deterministic extraction, not a general-purpose AI summarizer or OCR service.

## Evidence and interpretation

The full transcript takes precedence over the short summary for what was said. It contains multilingual transcription errors, duplicate captions and AI responses read aloud. Exact text is preserved. The meeting label comes from the filename (22:05 GMT+8); recorded speech spans 22:33:15–00:59:55.

The chicken’s omission receives an explanation at 00:58:53 and an acknowledgment at 00:59:09. The record does not establish a copyright requirement to remove it or an agreed restoration task. V2 was shown during the call. Production, in-meeting review, and release approval remain separate.

Source PDFs include author Ursula Nafula, illustrator Catherine Groenewald and Chinese translator Vicky Liu. The [Storybooks Canada source](https://www.storybookscanada.ca/stories/zh/0294/) and [CC BY 3.0 deed](https://creativecommons.org/licenses/by/3.0/) were checked on 19 October 2026. The app reports attribution evidence and remaining questions; it does not issue legal clearance.

## Storage and privacy

The five supplied sources are bundled with the site and retain its existing audience. Tracker edits use account-scoped browser storage; use its JSON backup to move changes across browsers. Meeting content and analysis caches use DuckDB-Wasm 1.32.0 in OPFS, with checkpoints after writes and an exclusive browser lock for each account database. DuckDB is pinned because the npm `latest` version tested during development did not persist OPFS writes across reloads. The engine and worker are served from this app; its compressed engine is unpacked locally before instantiation.

Zoom credentials and encrypted user tokens live only in the server environment/D1. The app preserves Sites sign-in as workspace identity and uses Zoom as the connected data provider. OAuth credentials still need to be supplied before live sign-in can work. Zoom imports require read permissions and available cloud transcripts. No general-purpose AI API or OCR service is configured.

The browser cache is device-local, can be evicted by the browser, and is not cross-device synchronization. Export it before clearing browser data. A cached item can be opened without refetching Zoom while its workspace is available; this is not an offline service worker/PWA. Fonts load from Google Fonts with local fallbacks.

## Verification

```sh
npm test
node tests/zoom-browser-check.mjs # against a running local server
npm run build
```

The tests check the real summary and transcript, multilingual PDF evidence, source citation integrity, provenance, backup validation, CSV formula escaping, and overdue handling. `tests/browser-check.mjs` exercises the UI against a running local server using installed Google Chrome; set `MINUTES_BASE_URL` to test a different local URL.

Source review data is in `src/data.js`; immutable source text and PDFs are in `public/sources/`. Browser extraction logic is in `src/analyzer.js`.

Zoom server logic is in `server/zoom.mjs`; the browser database is in `src/meeting-cache.js`. The server tests use real SQLite through Node’s test runner; Zoom provider calls are fixtures. Browser tests exercise actual DuckDB storage, reload persistence, account separation, analysis restoration, bulk transcript caching, and rate-limit resume. Live OAuth and Zoom API access remain unverified until credentials are configured.

## Railway and AI CUBER marketplace

Deploy this repository as a separate Railway service. `railway.json` selects the multi-stage `Dockerfile`, which builds Next.js standalone output on Node 22.23.1 and packages the server, static assets, DuckDB engine, and PDF.js worker. The container listens on `0.0.0.0` and Railway's `PORT` (default `3000`). It prepares SQLite directory permissions at startup, then runs Node as the unprivileged `node` user. Configuration and secrets are supplied at runtime; `.dockerignore` excludes local environment files, databases, and build artifacts.

1. Push these changes to GitHub, then create a Railway service from `kenken64/aicuber-meeting-minutes`, with this app directory as its root (the repository root in this repo).
2. Attach a persistent Railway volume mounted at `/data`. Use one replica; `railway.json` sets this explicitly.
3. Set the variables listed below and generate a public Railway domain. Set `APP_ORIGIN` and Zoom URLs to that domain.
4. Deploy using the Dockerfile's default entrypoint and command. Clear any old custom build/start commands in the Railway service settings. Railway checks `/api/health`, which returns `200` when the server can initialize and query SQLite, or `503` when storage is unavailable. It does not require marketplace login or Zoom credentials.
5. Open the app from AI CUBER Marketplace to verify a real signed launch, then connect Zoom.

Zoom connections and OAuth state are stored in SQLite at `/data/minutes.sqlite`. Back up the volume and retain the encryption key: replacing either loses access to existing connections. Browser meeting caches remain device-local. This SQLite setup is for a single replica, not multiple instances sharing a database.

Set these Railway variables on the minutes service:

- `APP_ORIGIN`: its public HTTPS origin, without a trailing slash (for example `https://minutes.up.railway.app`).
- `MEETING_MINUTES_SESSION_SECRET`: a random secret of at least 32 bytes, shared with AI CUBER.
- `MARKETPLACE_LAUNCH_VERIFY_URL`: `https://YOUR-2NDBRAIN-DOMAIN/api/marketplace/launch-session/verify`.
- `MARKETPLACE_LAUNCH_VERIFY_SECRET`: the same random secret of at least 32 bytes configured on AI CUBER.
- `MINUTES_DB_PATH`: `/data/minutes.sqlite`.
- `ZOOM_CLIENT_ID`, `ZOOM_CLIENT_SECRET`, `ZOOM_TOKEN_KEY`, and optionally `ZOOM_WEBHOOK_SECRET`: see [Zoom setup](docs/ZOOM_SETUP.md). Generate `ZOOM_TOKEN_KEY` with `node -e "console.log(require('node:crypto').randomBytes(32).toString('base64url'))"` and keep it stable. Configure Zoom's redirect URL as `https://YOUR-MINUTES-DOMAIN/api/zoom/callback` and its webhook URL as `https://YOUR-MINUTES-DOMAIN/api/zoom/webhook` if using webhooks.

On AI CUBER, set `MEETING_MINUTES_URL` to `https://YOUR-MINUTES-DOMAIN/api/2ndbrain/launch`, set `MEETING_MINUTES_SESSION_SECRET` to the matching value, and configure `MARKETPLACE_LAUNCH_VERIFY_SECRET`. Deploy the marketplace changes as well. Users install Meeting Minutes in Marketplace and launch it from My Workflows. Sessions last up to eight hours and are checked against AI CUBER for logout, disabled accounts, and uninstall; if verification is unavailable, access fails closed. Zoom OAuth requires valid credentials and a Zoom app configured for the service's public URL.

### Test the deployment locally

With Docker installed, create an ignored `.env.railway` containing the runtime variables above. Use `APP_ORIGIN=http://localhost:3000` for local testing (Zoom OAuth requires an approved public callback URL):

```sh
docker build -t meeting-minutes .
docker run --rm --name meeting-minutes -p 3000:3000 --env-file .env.railway \
  --mount type=volume,source=minutes-data,target=/data meeting-minutes
```

In another terminal, run `curl --fail http://localhost:3000/api/health`. The workspace requires an AI CUBER session; directly opening `/` without one returns `401`. The named Docker volume survives container removal. For a local production check without Docker:

```sh
npm run build:railway
npm run test:deployment
```

The deployment smoke check runs the packaged standalone server on a temporary port with a fixture marketplace verifier. It checks health without login, protected routes, a signed marketplace launch, static assets, and SQLite persistence across a server restart. It uses a temporary database and does not contact Zoom or AI CUBER.

Reference: [Railway Dockerfiles](https://docs.railway.com/builds/dockerfiles), [Railway healthchecks](https://docs.railway.com/deployments/healthchecks), and [Next.js standalone output](https://nextjs.org/docs/app/api-reference/config/next-config-js/output).
