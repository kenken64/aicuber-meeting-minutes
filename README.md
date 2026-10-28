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

Zoom connections are managed centrally by 2ndBrain. Users keep their original 2ndBrain login and connect Zoom separately through its Supabase provider. Meeting Minutes calls a restricted server-to-server integration API; Zoom credentials and provider tokens remain in 2ndBrain. Connection changes apply to subsequent requests without restarting Meeting Minutes. Zoom imports require read permissions and available cloud transcripts. No general-purpose AI API or OCR service is configured.

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

`railway.json` selects the multi-stage `Dockerfile`. It builds Next.js standalone output on Node 22.23.1, packages static assets, DuckDB and PDF.js workers, and runs as the unprivileged `node` user. The server binds to `0.0.0.0` and Railway’s `PORT` (default `3000`). `/api/health` is an unauthenticated process health check. Local environment files and build artifacts are excluded from the image.

Set these runtime variables on Meeting Minutes:

```dotenv
APP_ORIGIN=https://YOUR-MINUTES-DOMAIN
MEETING_MINUTES_SESSION_SECRET=MATCHING_RANDOM_SECRET_AT_LEAST_32_BYTES
MARKETPLACE_LAUNCH_VERIFY_URL=https://YOUR-2NDBRAIN-DOMAIN/api/marketplace/launch-session/verify
MARKETPLACE_LAUNCH_VERIFY_SECRET=MATCHING_DIFFERENT_RANDOM_SECRET_AT_LEAST_32_BYTES
```

No Zoom environment variables or persistent server volume are required here. Zoom settings, encrypted credentials, tokens, refreshes and optional webhooks live in 2ndBrain. The browser DuckDB library remains device-local. Legacy Sites/server Zoom modules are retained for source compatibility; the Railway API routes use the central integration service exclusively.

On 2ndBrain set `MEETING_MINUTES_URL=https://YOUR-MINUTES-DOMAIN/api/2ndbrain/launch` and the matching session/verification secrets. Deploy its central Zoom integration, apply migration `0038_zoom_connections.sql`, enable the Supabase Zoom provider and manual identity linking, and configure its dedicated callback allow list. Its administrator enters the shared Zoom app credentials in Marketplace → Zoom for API token refresh. See [Zoom setup](docs/ZOOM_SETUP.md).

Users sign in to 2ndBrain normally, connect Zoom in Marketplace (or Settings → Integrations), then install/launch Meeting Minutes from My Workflows. The Zoom connection does not replace the original workspace login. Meeting Minutes shows **Connected through 2ndBrain** and links back to manage the connection. Saving/disconnecting a central connection applies on the next request, without restarting this app.

The integration endpoint is derived from the origin of `MARKETPLACE_LAUNCH_VERIFY_URL`: `/api/integrations/zoom/delegate`. It accepts only status, meeting lists, recordings and owned-transcript operations. Zoom credentials, provider tokens and Supabase login sessions never appear in launch URLs or app responses. The central service checks account/installation/session access for each request; access fails closed if verification is unavailable.

### Deploy or test

Push the code, connect the repository to Railway, configure the variables above, generate the public domain, and deploy using the default Dockerfile command. Clear obsolete custom start/build commands. A former `/data` volume is not used by the new integration; retain old data separately if you need a migration or rollback.

```sh
docker build -t meeting-minutes .
docker run --rm -p 3000:3000 --env-file .env.railway meeting-minutes
```

Create an ignored `.env.railway` with the variables above. Direct access to `/` without a marketplace session returns `401`. For a local production check:

```sh
npm test
npm run build:railway
npm run test:deployment
```

The smoke test launches the packaged server against a local HTTPS 2ndBrain fixture and checks login identity, assets, delegation, connection changes without restarting, and logout revocation. It requires `openssl` to generate its temporary test certificate and does not contact the live providers.
