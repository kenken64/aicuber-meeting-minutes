# Minutes — meeting analysis and follow-ups

A private, browser-based workspace for Kenneth, Lee and Jackson’s 14 October 2026 Zoom meeting. It incorporates the complete supplied transcript, the short meeting summary, and all three storybook PDFs.

## Run locally

Use Node 22.13 or newer (the `.nvmrc` selects 22.23.1):

```sh
nvm use
npm ci
npm run dev
```

Open the local URL printed by Vite. `npm run build` produces `dist/`. `npm run preview` serves the production build.

## What it does

- Reconciles the short summary with all 2,661 timestamped transcript utterances, including the rollover into 15 October.
- Maps the complete conversation to 15 discussion segments.
- Tracks five summary actions, three transcript requests and four proposed follow-ups, with distinct evidence and status.
- Compares the original Chinese story with both Malay adaptations, with page references, rendered examples and direct PDF access.
- Provides editable owners, statuses, dates and notes, CSV exports, a text report, JSON backup/restore and an editable follow-up message. It does not send messages.
- Extracts explicit next steps from additional structured TXT minutes and searches text in PDF references with PDF.js. New uploads stay in the browser and are not persisted. This is deterministic extraction, not a general-purpose AI summarizer or OCR service.

## Evidence and interpretation

The full transcript takes precedence over the short summary for what was said. It contains multilingual transcription errors, duplicate captions and AI responses read aloud. Exact text is preserved. The meeting label comes from the filename (22:05 GMT+8); recorded speech spans 22:33:15–00:59:55.

The chicken’s omission receives an explanation at 00:58:53 and an acknowledgment at 00:59:09. The record does not establish a copyright requirement to remove it or an agreed restoration task. V2 was shown during the call. Production, in-meeting review, and release approval remain separate.

Source PDFs include author Ursula Nafula, illustrator Catherine Groenewald and Chinese translator Vicky Liu. The [Storybooks Canada source](https://www.storybookscanada.ca/stories/zh/0294/) and [CC BY 3.0 deed](https://creativecommons.org/licenses/by/3.0/) were checked on 19 October 2026. The app reports attribution evidence and remaining questions; it does not issue legal clearance.

## Storage and privacy

The five supplied sources are bundled with the private site. Tracker edits use this browser’s localStorage and are not shared across devices. Export a JSON backup before changing browsers or clearing site data. Newly uploaded TXT/PDF files are processed in memory. There is no AI API key or backend. Fonts load from Google Fonts, with local system fallbacks.

## Verification

```sh
npm test
npm run build
```

The tests check the real summary and transcript, multilingual PDF evidence, source citation integrity, provenance, backup validation, CSV formula escaping, and overdue handling. `tests/browser-check.mjs` exercises the UI against a running local server using installed Google Chrome; set `MINUTES_BASE_URL` to test a different local URL.

Source review data is in `src/data.js`; immutable source text and PDFs are in `public/sources/`. Browser extraction logic is in `src/analyzer.js`.
