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
