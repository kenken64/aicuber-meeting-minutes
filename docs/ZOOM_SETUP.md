# Connect Zoom through 2ndBrain

1. Sign into 2ndBrain using your existing login method.
2. Open Marketplace → Zoom, or Settings → Integrations → Zoom, and select **Connect Zoom**.
3. Complete Zoom consent through the Supabase Zoom provider. The dedicated connection callback verifies the same 2ndBrain user and leaves the initial login cookies and workspace profile unchanged.
4. Install and launch Meeting Minutes from My Workflows. Its Zoom meetings screen shows **Connected through 2ndBrain**.
5. To reconnect or disconnect, follow **Manage Zoom in 2ndBrain**. Changes apply to the next request without restarting Meeting Minutes.

## Administrator setup in 2ndBrain

- Apply `supabase/migrations/0038_zoom_connections.sql` in the 2ndBrain repository.
- Enable Supabase’s Zoom provider and manual identity linking. Keep the existing login provider and callback settings intact.
- The Zoom app OAuth callback is your Supabase project’s `https://YOUR-PROJECT.supabase.co/auth/v1/callback`.
- Add `https://YOUR-2NDBRAIN-DOMAIN/api/integrations/zoom/callback**` to the Supabase redirect allow list. This is a separate connection callback, not the existing `/auth/callback` login flow.
- Grant the Zoom app’s user-level read scopes: `user:read:user`, `meeting:read:list_meetings`, `meeting:read:list_upcoming_meetings`, `cloud_recording:read:list_user_recordings` and `cloud_recording:read:list_recording_files`.
- An admin with the existing TOTP verification saves the same Zoom Client ID and Secret in the central provider configuration. Supabase issues provider tokens, but does not refresh them; the central service uses these encrypted credentials for Zoom API refreshes.
- Configure durable encryption-key storage on the 2ndBrain service. Its setup guide is `docs/ZOOM_MARKETPLACE.md`. There are no Zoom keys, secrets or token storage to configure on Meeting Minutes.
- If using webhooks, save the optional Webhook Secret centrally and copy the generated webhook URL into Zoom. Deauthorization applies centrally to future tool requests.

Each user authorizes their own Zoom account; the shared provider app belongs to the platform. Distribution and test-account access remain subject to Zoom configuration and approval. Meeting Minutes cannot access local/deleted recordings or a complete attendance history, and cloud transcripts must already exist.

## Ownership and security

2ndBrain stores encrypted Zoom credentials/tokens and is the only service that refreshes them. Its delegated API validates the signed Meeting Minutes session, owner, active installation, original launch time and logout/account restrictions for every call. Only supported read operations are allowed; transcript ownership and HTTPS download hosts are checked centrally. No provider tokens are exported to this app.

Browser caches remain scoped to the primary workspace user and connected Zoom account. Changing accounts closes the previous cache; disconnecting centrally blocks further Zoom fetches. Saved browser content is device-local and can still be managed through Saved library.

Live consent, linking, provider permissions and Zoom imports require the configured services and have not been verified by fixture tests.

References: [Supabase identity linking](https://supabase.com/docs/guides/auth/auth-identity-linking), [Supabase provider tokens](https://supabase.com/docs/guides/auth/social-sign-in#provider-tokens), [Zoom OAuth](https://developers.zoom.us/docs/integrations/oauth/).
