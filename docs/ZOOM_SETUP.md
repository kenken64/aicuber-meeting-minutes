# Zoom connection setup

The app supports one user-managed Zoom connection per signed-in Sites visitor. Sites supplies the workspace identity; Zoom OAuth supplies access to that visitor’s Zoom account. The public site and original source review remain accessible without connecting Zoom.

## Create the Zoom app

1. Open [Zoom App Marketplace](https://marketplace.zoom.us/) → Develop → Build App → General App. Choose **User-managed**. This is not a Server-to-Server app and does not need a Meeting SDK.
2. Use matching Development credentials for local testing or Production credentials for distribution.
3. Register this exact OAuth redirect URL and allow-list it; enable strict matching:

   `https://meeting-minutes-followup.wiry-eagle-9459.chatgpt.site/api/zoom/callback`

4. Add only these user-level read scopes (no `:admin` or `:master` variants):

   | Scope | Used for |
   | --- | --- |
   | `user:read:user` | Identify the connected Zoom user |
   | `meeting:read:list_meetings` | Page through valid hosted meetings |
   | `meeting:read:list_upcoming_meetings` | Upcoming/invited meetings in the next 24 hours |
   | `cloud_recording:read:list_user_recordings` | Page through cloud recording history |
   | `cloud_recording:read:list_recording_files` | Locate and download an available audio transcript |

5. Configure the deauthorization/notification endpoint as:

   `https://meeting-minutes-followup.wiry-eagle-9459.chatgpt.site/api/zoom/webhook`

   Add the app’s webhook Secret Token to the runtime environment below. The endpoint verifies the HMAC signature and timestamp, answers endpoint validation challenges, and deletes the affected connection on `app_deauthorized`.
6. Add the runtime credentials, then deploy the saved site version to apply them.
7. Test using Zoom’s Local Test flow. Sharing outside your developer account is subject to Zoom’s current beta/distribution and Marketplace review requirements. A deployed website alone does not approve the Zoom app for all users. Follow the Marketplace’s distribution workflow before offering sign-in broadly.

## Runtime secrets

Set these through Sites runtime environment settings or have the agent configure them from an ignored local `.env.zoom` file. **Do not paste secrets into chat, commit them, or put them in frontend `VITE_` variables.**

| Variable | Value |
| --- | --- |
| `ZOOM_CLIENT_ID` | Your Zoom app’s Client ID |
| `ZOOM_CLIENT_SECRET` | Matching Client Secret; mark secret |
| `ZOOM_WEBHOOK_SECRET` | Zoom webhook Secret Token; mark secret |
| `ZOOM_TOKEN_KEY` | Already configured: 32 random bytes, base64url encoded; mark secret |
| `APP_ORIGIN` | Already configured: `https://meeting-minutes-followup.wiry-eagle-9459.chatgpt.site` |

Use `.env.example` as a key-name reference. Keep the generated token key stable: replacing it without a data migration makes existing connections unreadable and requires reconnection. The app reports Setup required until the client credentials, encryption key, origin, and database are available.

## Visitor flow and available data

Visitors open Zoom meetings, sign in to their workspace if needed, then use Connect with Zoom. OAuth state is single-use, expires after ten minutes, and is bound to both the signed-in visitor and a secure HttpOnly browser cookie. Access and refresh tokens are encrypted server-side in D1 and are never sent to browser code or DuckDB. Expired tokens rotate under a database lock. API routes use `/users/me` and verify ownership before downloading a transcript.

Hosted meetings are valid, unexpired scheduled meetings; they are not a complete attendance history. The invited list is restricted by Zoom to the next 24 hours and depends on calendar integration. Cloud recordings require an eligible plan and enabled cloud recording; transcripts must already exist. The app searches every page across contiguous 28-day windows and can resume partial searches. Local recordings, deleted recordings, and inaccessible meetings are not recoverable through this integration. Download redirects to unrecognized hosts are refused; upload those transcripts manually instead.

## Browser DuckDB cache

The browser runs DuckDB-Wasm and stores a database in OPFS (Origin Private File System). Fetched meeting records are upserted by instance UUID. The **Cache available transcripts** action downloads all completed transcripts in the fetched recording list and skips copies already cached. Each imported/uploaded text and each analysis result is cached, including extracted PDF reference text. The original complete transcript, short minutes, and curated analysis are also available in Saved library.

Saved library searches cached titles, minutes, and analysis text locally; opens cached sources/results; exports a JSON backup; and clears this workspace’s cache. It survives reloads on the same device. It is not server synchronization or an offline copy of the entire website. Browser data clearing or storage eviction can remove it. Separate workspace database files prevent app-level account mixing; a shared browser/device is not a security boundary against someone with local disk or developer-tool access.

Disconnect removes server credentials and clears the active local cache. Signing out closes access to that account’s cache in the app; reconnecting the same account restores its remaining cache. The server cannot remotely erase browser files on another device; clear Saved library on each shared device. The webhook deletes server data when Zoom deauthorizes the app.

## Verification and deployment

Run `npm test` for source integrity, OAuth state, ownership, encryption, token rotation, rate limits, pagination, and download-host checks. `tests/zoom-browser-check.mjs` checks real DuckDB persistence and UI behavior with explicitly mocked Zoom responses; mocks do not verify live Zoom consent or account permissions. Live authorization/import must be checked after the app credentials and distribution permissions are configured.

The app uses the supported Sites Vinext Worker build with a D1 migration in `drizzle/`. `npm run dev` starts portable preview. Generate schema migrations with `npm run db:generate`; do not alter applied migrations. `npm run build` prepares the compressed DuckDB engine asset and builds the Worker. The engine is served from this app, not a third-party CDN.

## Official references

- [Zoom OAuth](https://developers.zoom.us/docs/integrations/oauth/)
- [Create a Zoom OAuth app](https://developers.zoom.us/docs/integrations/create/)
- [Zoom granular scopes](https://developers.zoom.us/docs/integrations/oauth-scopes-granular/)
- [Zoom Meetings API](https://developers.zoom.us/docs/api/meetings/)
- [DuckDB-Wasm persistence with OPFS](https://duckdb.org/docs/current/clients/wasm/instantiation)
