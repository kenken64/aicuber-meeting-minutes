// Zoom is a data connection. Sites continues to own the visitor's app identity.
const API = 'https://api.zoom.us/v2';
const CALLBACK = '/api/zoom/callback';
const STATE_COOKIE = '__Host-minutes-zoom-state';
const encoder = new TextEncoder();
const decoder = new TextDecoder();
const MAX_TRANSCRIPT = 5 * 1024 * 1024;
const PRIVATE = { 'Cache-Control': 'private, no-store', 'Referrer-Policy': 'no-referrer', 'X-Content-Type-Options': 'nosniff' };
export class ZoomError extends Error {
  constructor(message, status = 400, code = 'invalid_request', retryAfter = 0) {
    super(message); Object.assign(this, { status, code, retryAfter });
  }
}
const json = (value, status = 200, headers = {}) => new Response(JSON.stringify(value), { status, headers: { ...PRIVATE, 'Content-Type': 'application/json', ...headers } });
const redirect = (location, cookie) => new Response(null, { status: 303, headers: { ...PRIVATE, Location: location, ...(cookie ? { 'Set-Cookie': cookie } : {}) } });
const random = () => base64(crypto.getRandomValues(new Uint8Array(32)));
function base64(bytes) { return btoa(String.fromCharCode(...bytes)).replaceAll('+', '-').replaceAll('/', '_').replaceAll('=', ''); }
function unbase64(value) { return Uint8Array.from(atob(value.replaceAll('-', '+').replaceAll('_', '/')), c => c.charCodeAt(0)); }
export async function hash(value) { return base64(new Uint8Array(await crypto.subtle.digest('SHA-256', encoder.encode(value)))); }
function same(a, b) { if (typeof a !== 'string' || typeof b !== 'string' || a.length !== b.length) return false; let diff = 0; for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i); return diff === 0; }
async function encryptionKey(env) { return crypto.subtle.importKey('raw', unbase64(env.ZOOM_TOKEN_KEY), 'AES-GCM', false, ['encrypt', 'decrypt']); }
export async function seal(value, env, ownerId) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encrypted = await crypto.subtle.encrypt({ name: 'AES-GCM', iv, additionalData: encoder.encode(ownerId) }, await encryptionKey(env), encoder.encode(JSON.stringify(value)));
  return `${base64(iv)}.${base64(new Uint8Array(encrypted))}`;
}
export async function unseal(value, env, ownerId) {
  const [iv, cipher] = value.split('.');
  return JSON.parse(decoder.decode(await crypto.subtle.decrypt({ name: 'AES-GCM', iv: unbase64(iv), additionalData: encoder.encode(ownerId) }, await encryptionKey(env), unbase64(cipher))));
}
function configured(env) {
  try { return !!(env.ZOOM_CLIENT_ID && env.ZOOM_CLIENT_SECRET && env.APP_ORIGIN && env.DB && unbase64(env.ZOOM_TOKEN_KEY).length === 32 && new URL(env.APP_ORIGIN).protocol === 'https:'); } catch { return false; }
}
function origin(env) { return new URL(env.APP_ORIGIN).origin; }
function requireOrigin(request, env) { if (request.headers.get('Origin') !== origin(env)) throw new ZoomError('This request must come from your meeting workspace.', 403, 'invalid_origin'); }
function requireUser(user) { if (!user?.userId) throw new ZoomError('Sign in to your workspace before connecting Zoom.', 401, 'sign_in_required'); }
const connection = (env, owner) => env.DB.prepare('SELECT * FROM zoom_connections WHERE owner_id = ?').bind(owner).first();
function stateCookie(value, seconds = 600) { return `${STATE_COOKIE}=${value}; Path=/; Max-Age=${seconds}; HttpOnly; Secure; SameSite=Lax`; }
function readCookie(request) { return request.headers.get('Cookie')?.split(';').map(s => s.trim()).find(s => s.startsWith(STATE_COOKIE + '='))?.slice(STATE_COOKIE.length + 1) || ''; }
async function fetchTimed(url, options = {}, fetcher = fetch) { return fetcher(url, { ...options, signal: AbortSignal.timeout(20000), redirect: 'manual' }); }
async function limitedText(response, maxBytes) {
  if (Number(response.headers.get('content-length')) > maxBytes) throw new ZoomError('The response is too large to import. Download it from Zoom and upload a smaller TXT file.', 413, 'too_large');
  if (!response.body) return '';
  const reader = response.body.getReader(); let size = 0, text = ''; const decode = new TextDecoder();
  try { while (true) { const { done, value } = await reader.read(); if (done) break; size += value.byteLength; if (size > maxBytes) { await reader.cancel(); throw new ZoomError('The transcript exceeds the 5 MB import limit.', 413, 'too_large'); } text += decode.decode(value, { stream: true }); } return text + decode.decode(); } finally { reader.releaseLock(); }
}
async function providerError(response) {
  if (response.status === 429) {
    const raw = response.headers.get('Retry-After');
    const retry = Number(raw) || Math.ceil((Date.parse(raw) - Date.now()) / 1000) || 60;
    return new ZoomError('Zoom’s rate limit was reached. Your results are kept; resume after the wait.', 429, 'rate_limited', Math.max(1, Math.min(retry, 86400)));
  }
  if (response.status === 401) return new ZoomError('Your Zoom authorization expired or was revoked. Reconnect Zoom.', 401, 'reconnect_required');
  if (response.status === 403 || response.status === 400) return new ZoomError('Zoom did not allow this request. Check the app’s read scopes, account permissions, and cloud recording plan.', 403, 'zoom_access_denied');
  if (response.status === 404) return new ZoomError('This meeting or recording is no longer available in Zoom.', 404, 'not_available');
  return new ZoomError('Zoom is temporarily unavailable. Your existing results are kept; please retry.', 502, 'zoom_unavailable');
}
async function tokenRequest(env, params, fetcher) {
  const response = await fetchTimed('https://zoom.us/oauth/token', {
    method: 'POST', headers: { Authorization: `Basic ${btoa(`${env.ZOOM_CLIENT_ID}:${env.ZOOM_CLIENT_SECRET}`)}`, 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams(params),
  }, fetcher);
  if (!response.ok) throw response.status === 400 || response.status === 401 ? new ZoomError('Zoom authorization could not be renewed. Reconnect your account.', 401, 'reconnect_required') : await providerError(response);
  const result = await response.json();
  if (!result.access_token || !result.refresh_token || !(result.expires_in > 0)) throw new ZoomError('Zoom returned an incomplete authorization response.', 502, 'invalid_zoom_response');
  return result;
}
async function saveConnection(env, userId, profile, tokens) {
  await env.DB.prepare(`INSERT INTO zoom_connections (owner_id, zoom_user_id, display_name, email, token_cipher, expires_at) VALUES (?, ?, ?, ?, ?, ?)
    ON CONFLICT(owner_id) DO UPDATE SET zoom_user_id = excluded.zoom_user_id, display_name = excluded.display_name, email = excluded.email, token_cipher = excluded.token_cipher, expires_at = excluded.expires_at, refresh_owner = NULL, refresh_until = NULL`)
    .bind(userId, profile.id, profile.display_name || `${profile.first_name || ''} ${profile.last_name || ''}`.trim() || 'Zoom user', profile.email || '', await seal(tokens, env, userId), Date.now() + tokens.expires_in * 1000).run();
}
async function accessToken(env, userId, fetcher, rejectedToken) {
  let row = await connection(env, userId);
  if (!row) throw new ZoomError('Connect your Zoom account to continue.', 401, 'reconnect_required');
  let tokens = await unseal(row.token_cipher, env, userId);
  if (row.expires_at > Date.now() + 60000 && tokens.access_token !== rejectedToken) return { row, token: tokens.access_token };
  const lock = random(); const now = Date.now();
  row = await env.DB.prepare('UPDATE zoom_connections SET refresh_owner = ?, refresh_until = ? WHERE owner_id = ? AND (refresh_until IS NULL OR refresh_until < ?) RETURNING *').bind(lock, now + 45000, userId, now).first();
  if (!row) throw new ZoomError('Your Zoom connection is being renewed. Please retry in a moment.', 409, 'refresh_in_progress', 2);
  try {
    tokens = await unseal(row.token_cipher, env, userId);
    if (row.expires_at > Date.now() + 60000 && tokens.access_token !== rejectedToken) return { row, token: tokens.access_token };
    const fresh = await tokenRequest(env, { grant_type: 'refresh_token', refresh_token: tokens.refresh_token }, fetcher);
    const updated = await env.DB.prepare('UPDATE zoom_connections SET token_cipher = ?, expires_at = ? WHERE owner_id = ? AND refresh_owner = ? RETURNING owner_id').bind(await seal(fresh, env, userId), Date.now() + fresh.expires_in * 1000, userId, lock).first();
    if (!updated) throw new ZoomError('The Zoom connection changed. Refresh this page.', 409, 'connection_changed');
    return { row, token: fresh.access_token };
  } catch (error) {
    if (error.code === 'reconnect_required') await env.DB.prepare('DELETE FROM zoom_connections WHERE owner_id = ? AND refresh_owner = ?').bind(userId, lock).run();
    throw error;
  } finally { await env.DB.prepare('UPDATE zoom_connections SET refresh_owner = NULL, refresh_until = NULL WHERE owner_id = ? AND refresh_owner = ?').bind(userId, lock).run(); }
}
async function api(env, userId, path, fetcher) {
  let auth = await accessToken(env, userId, fetcher);
  let response = await fetchTimed(API + path, { headers: { Authorization: `Bearer ${auth.token}` } }, fetcher);
  if (response.status === 401) { auth = await accessToken(env, userId, fetcher, auth.token); response = await fetchTimed(API + path, { headers: { Authorization: `Bearer ${auth.token}` } }, fetcher); }
  if (!response.ok) throw await providerError(response);
  return { data: await response.json(), ...auth };
}
export function encodeMeetingUuid(uuid) { const once = encodeURIComponent(uuid); return uuid.startsWith('/') || uuid.includes('//') ? encodeURIComponent(once) : once; }
export function validateDateRange(from, to) {
  const valid = s => /^\d{4}-\d{2}-\d{2}$/.test(s || '') && Number.isFinite(Date.parse(s)) && new Date(s).toISOString().slice(0, 10) === s;
  if (!valid(from) || !valid(to) || from > to || (Date.parse(to) - Date.parse(from)) / 86400000 > 27) throw new ZoomError('Choose a recording window of up to 28 days. Longer searches are split automatically.');
}
function pageToken(value) { if (value.length > 2048) throw new ZoomError('The page cursor is invalid.'); return value; }
export function safeZoomUrl(value) {
  try { const u = new URL(value); return u.protocol === 'https:' && !u.username && !u.password && (!u.port || u.port === '443') && ['zoom.us', 'zoom.com'].some(h => u.hostname === h || u.hostname.endsWith('.' + h)) ? u.href : null; } catch { return null; }
}
function publicMeeting(m, recording = false) {
  return { id: String(m.id), uuid: m.uuid || String(m.id), topic: m.topic || 'Untitled Zoom meeting', startTime: m.start_time || '', duration: m.duration || 0, timezone: m.timezone || '', type: m.type, kind: recording ? 'recording' : 'meeting', url: safeZoomUrl(recording ? m.share_url : m.join_url), files: recording ? (m.recording_files || []).filter(f => f.recording_type === 'audio_transcript' || f.file_type === 'TRANSCRIPT').map(f => ({ id: f.id, status: f.status, type: f.recording_type || f.file_type, size: f.file_size || 0 })) : [] };
}
async function requestJson(request) {
  if (!request.headers.get('Content-Type')?.includes('application/json')) throw new ZoomError('Expected JSON.', 415);
  const text = await limitedText(request, 8192); try { return JSON.parse(text); } catch { throw new ZoomError('Invalid JSON.'); }
}
async function downloadTranscript(url, token, fetcher) {
  let target = safeZoomUrl(url);
  for (let hop = 0; hop < 4; hop++) {
    if (!target) throw new ZoomError('This recording uses an unsupported download host. Open it in Zoom and upload its transcript as TXT.', 422, 'download_host');
    const response = await fetchTimed(target, { headers: { Authorization: `Bearer ${token}` } }, fetcher);
    if ([301, 302, 303, 307, 308].includes(response.status)) { target = safeZoomUrl(new URL(response.headers.get('Location') || '', target).href); continue; }
    if (!response.ok) throw await providerError(response);
    const text = await limitedText(response, MAX_TRANSCRIPT);
    if (!text.trim() || /<!doctype html|<html[\s>]/i.test(text.slice(0, 300))) throw new ZoomError('Zoom did not return a readable transcript. It may still be processing.', 422, 'transcript_unavailable');
    return text;
  }
  throw new ZoomError('Zoom’s download redirected too many times. Open the transcript in Zoom.', 502, 'download_redirect');
}
async function hmac(secret, message) { const key = await crypto.subtle.importKey('raw', encoder.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']); return [...new Uint8Array(await crypto.subtle.sign('HMAC', key, encoder.encode(message)))].map(x => x.toString(16).padStart(2, '0')).join(''); }
async function webhook(request, env) {
  if (request.method !== 'POST') throw new ZoomError('Method not allowed.', 405);
  if (!env.ZOOM_WEBHOOK_SECRET || !env.DB) throw new ZoomError('Webhook setup is incomplete.', 503, 'setup_required');
  const raw = await limitedText(request, 65536);
  const timestamp = request.headers.get('x-zm-request-timestamp') || '';
  if (!/^\d+$/.test(timestamp) || Math.abs(Date.now() / 1000 - Number(timestamp)) > 300 || !same(request.headers.get('x-zm-signature'), 'v0=' + await hmac(env.ZOOM_WEBHOOK_SECRET, `v0:${timestamp}:${raw}`))) throw new ZoomError('Invalid webhook signature.', 401);
  let event; try { event = JSON.parse(raw); } catch { throw new ZoomError('Invalid JSON.'); }
  if (event.event === 'endpoint.url_validation') {
    const plainToken = event.payload?.plainToken;
    if (typeof plainToken !== 'string' || plainToken.length > 1024) throw new ZoomError('Invalid validation token.');
    return json({ plainToken, encryptedToken: await hmac(env.ZOOM_WEBHOOK_SECRET, plainToken) });
  }
  if (event.event === 'app_deauthorized') {
    if (event.payload?.client_id !== env.ZOOM_CLIENT_ID || typeof event.payload?.user_id !== 'string') throw new ZoomError('Invalid deauthorization event.');
    await env.DB.batch([
      env.DB.prepare('DELETE FROM zoom_oauth_states WHERE owner_id IN (SELECT owner_id FROM zoom_connections WHERE zoom_user_id = ?)').bind(event.payload.user_id),
      env.DB.prepare('DELETE FROM zoom_connections WHERE zoom_user_id = ?').bind(event.payload.user_id),
    ]);
  }
  return json({ received: true });
}
export async function handleZoomRequest(request, env, user, fetcher = fetch) {
  const url = new URL(request.url); const path = url.pathname.replace(/^\/api\/zoom\//, '');
  try {
    if (path === 'webhook') return await webhook(request, env);
    if (path === 'status' && request.method === 'GET') {
      const row = user?.userId && configured(env) ? await connection(env, user.userId) : null;
      return json({ configured: configured(env), authenticated: !!user?.userId, visitor: user?.userId ? { name: user.displayName || user.email || 'Your workspace', email: user.email || '' } : null, connected: !!row, signInPath: '/signin-with-chatgpt?return_to=%2F%23zoom', signOutPath: '/signout-with-chatgpt?return_to=%2F%23zoom', profile: row ? { name: row.display_name, email: row.email } : null, cacheKey: user?.userId ? await hash('cache:' + user.userId + (row ? ':' + row.zoom_user_id : '')) : null, workspaceKey: row ? await hash(user.userId + ':' + row.zoom_user_id) : null });
    }
    if (!configured(env)) throw new ZoomError('The site owner needs to finish the Zoom app setup before accounts can connect.', 503, 'setup_required');
    requireUser(user);
    if (path === 'connect' && request.method === 'POST') {
      requireOrigin(request, env);
      const state = random(), browser = random();
      await env.DB.batch([
        env.DB.prepare('DELETE FROM zoom_oauth_states WHERE expires_at < ? OR owner_id = ?').bind(Date.now(), user.userId),
        env.DB.prepare('INSERT INTO zoom_oauth_states (state_hash, owner_id, browser_hash, expires_at) VALUES (?, ?, ?, ?)').bind(await hash(state), user.userId, await hash(browser), Date.now() + 600000),
      ]);
      const authorize = new URL('https://zoom.us/oauth/authorize');
      authorize.search = new URLSearchParams({ response_type: 'code', client_id: env.ZOOM_CLIENT_ID, redirect_uri: origin(env) + CALLBACK, state }).toString();
      return redirect(authorize.href, stateCookie(browser));
    }
    if (path === 'callback' && request.method === 'GET') {
      const state = url.searchParams.get('state'), browser = readCookie(request);
      if (!state || state.length > 128 || !browser || browser.length > 128) throw new ZoomError('The Zoom sign-in request expired. Please reconnect.', 400, 'invalid_state');
      const consumed = await env.DB.prepare('DELETE FROM zoom_oauth_states WHERE state_hash = ? AND owner_id = ? AND browser_hash = ? AND expires_at > ? RETURNING state_hash').bind(await hash(state), user.userId, await hash(browser), Date.now()).first();
      if (!consumed) throw new ZoomError('The Zoom sign-in request expired or was already used. Please reconnect.', 400, 'invalid_state');
      if (url.searchParams.has('error')) return redirect('/?zoom_error=authorization_declined#zoom', stateCookie('', 0));
      const code = url.searchParams.get('code'); if (!code || code.length > 2048) throw new ZoomError('Zoom did not provide an authorization code.');
      const tokens = await tokenRequest(env, { grant_type: 'authorization_code', code, redirect_uri: origin(env) + CALLBACK }, fetcher);
      const profileResponse = await fetchTimed(API + '/users/me', { headers: { Authorization: `Bearer ${tokens.access_token}` } }, fetcher);
      if (!profileResponse.ok) throw await providerError(profileResponse);
      const profile = await profileResponse.json(); if (!profile.id) throw new ZoomError('Zoom did not return your account identity.', 502);
      await saveConnection(env, user.userId, profile, tokens);
      return redirect('/?zoom_connected=1#zoom', stateCookie('', 0));
    }
    if (['meetings', 'recordings', 'transcript', 'disconnect'].includes(path)) {
      const current = await connection(env, user.userId);
      if (!current) throw new ZoomError('Connect your Zoom account to continue.', 401, 'reconnect_required');
      if (!same(request.headers.get('X-Workspace-Key'), await hash(user.userId + ':' + current.zoom_user_id))) throw new ZoomError('Your signed-in account changed. Reload the page before continuing.', 409, 'connection_changed');
    }
    if (path === 'meetings' && request.method === 'GET') {
      const kind = url.searchParams.get('kind') || 'scheduled';
      if (!['scheduled', 'invited'].includes(kind)) throw new ZoomError('Unknown meeting list.');
      const query = new URLSearchParams({ page_size: '100', next_page_token: pageToken(url.searchParams.get('pageToken') || '') });
      if (kind === 'scheduled') query.set('type', 'scheduled');
      const { data } = await api(env, user.userId, `/users/me/${kind === 'invited' ? 'upcoming_meetings' : 'meetings'}?${query}`, fetcher);
      return json({ meetings: (data.meetings || []).map(m => publicMeeting(m)), nextPageToken: data.next_page_token || '', total: data.total_records ?? null });
    }
    if (path === 'recordings' && request.method === 'GET') {
      const from = url.searchParams.get('from'), to = url.searchParams.get('to'); validateDateRange(from, to);
      const query = new URLSearchParams({ from, to, page_size: '100', next_page_token: pageToken(url.searchParams.get('pageToken') || '') });
      const { data } = await api(env, user.userId, `/users/me/recordings?${query}`, fetcher);
      return json({ meetings: (data.meetings || []).map(m => publicMeeting(m, true)), nextPageToken: data.next_page_token || '', from, to, total: data.total_records ?? null });
    }
    if (path === 'transcript' && request.method === 'POST') {
      requireOrigin(request, env); const body = await requestJson(request);
      if (typeof body.meetingUuid !== 'string' || body.meetingUuid.length > 256 || !body.meetingUuid || typeof body.fileId !== 'string' || body.fileId.length > 256) throw new ZoomError('Choose a meeting transcript.');
      const { data, row, token } = await api(env, user.userId, `/meetings/${encodeMeetingUuid(body.meetingUuid)}/recordings`, fetcher);
      if (data.host_id !== row.zoom_user_id) throw new ZoomError('Only recordings hosted by your connected Zoom account can be imported.', 403, 'recording_owner');
      const file = data.recording_files?.find(f => f.id === body.fileId && (f.recording_type === 'audio_transcript' || f.file_type === 'TRANSCRIPT') && f.status === 'completed');
      if (!file) throw new ZoomError('The transcript is missing or still processing.', 404, 'transcript_unavailable');
      if (file.file_size > MAX_TRANSCRIPT) throw new ZoomError('The transcript exceeds the 5 MB import limit.', 413, 'too_large');
      return json({ title: data.topic || 'Zoom meeting', startTime: data.start_time || '', text: await downloadTranscript(file.download_url, token, fetcher) });
    }
    if (path === 'disconnect' && request.method === 'POST') {
      requireOrigin(request, env); const row = await connection(env, user.userId); let revoked = false;
      if (row) {
        const tokens = await unseal(row.token_cipher, env, user.userId);
        try { const r = await fetchTimed('https://zoom.us/oauth/revoke', { method: 'POST', headers: { Authorization: `Basic ${btoa(`${env.ZOOM_CLIENT_ID}:${env.ZOOM_CLIENT_SECRET}`)}`, 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ token: tokens.access_token }) }, fetcher); revoked = r.ok && (await r.json()).status === 'success'; } catch { /* Local removal must still succeed. */ }
      }
      await env.DB.batch([env.DB.prepare('DELETE FROM zoom_connections WHERE owner_id = ?').bind(user.userId), env.DB.prepare('DELETE FROM zoom_oauth_states WHERE owner_id = ?').bind(user.userId)]);
      return json({ disconnected: true, revoked, message: revoked ? 'Zoom disconnected and authorization revoked.' : 'Connection removed here. You can also remove this app in Zoom Marketplace → Manage → Added Apps.' });
    }
    throw new ZoomError('Endpoint not found or method not allowed.', 404, 'not_found');
  } catch (error) {
    if (path === 'callback') return redirect('/?zoom_error=' + encodeURIComponent(error.code || 'connection_failed') + '#zoom', stateCookie('', 0));
    const known = error instanceof ZoomError;
    return json({ error: known ? error.message : 'The Zoom connection could not complete this request. Please retry.', code: known ? error.code : 'server_error', ...(error.retryAfter ? { retryAfter: error.retryAfter } : {}) }, known ? error.status : 500, error.retryAfter ? { 'Retry-After': String(error.retryAfter) } : {});
  }
}
