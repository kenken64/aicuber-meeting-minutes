import { createHmac, timingSafeEqual } from 'node:crypto';

const tool = 'meeting-minutes';
function secret() {
  const value = process.env.MEETING_MINUTES_SESSION_SECRET?.trim();
  if (!value || Buffer.byteLength(value) < 32) throw new Error('MEETING_MINUTES_SESSION_SECRET must be at least 32 bytes');
  return value;
}
function sign(data) { return createHmac('sha256', secret()).update(data).digest('base64url'); }
export function encode(claims) {
  const data = Buffer.from(JSON.stringify(claims)).toString('base64url');
  return `${data}.${sign(data)}`;
}
export function decode(token, launch = false) {
  try {
    const parts = token.split('.');
    if (parts.length !== (launch ? 3 : 2)) return null;
    const signed = parts.slice(0, -1).join('.');
    const actual = Buffer.from(parts.at(-1), 'base64url');
    const expected = Buffer.from(sign(signed), 'base64url');
    if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) return null;
    if (launch) {
      const header = JSON.parse(Buffer.from(parts[0], 'base64url').toString());
      if (header.alg !== 'HS256' || header.typ !== 'JWT') return null;
    }
    const c = JSON.parse(Buffer.from(parts[launch ? 1 : 0], 'base64url').toString());
    const now = Math.floor(Date.now() / 1000);
    if (c.iss !== '2ndBrain.ceo' || c.tool_id !== tool || typeof c.user_id !== 'string' || !c.user_id || typeof c.install_id !== 'string' || !c.install_id || !Number.isInteger(c.iat) || c.iat > now + 30 || !Number.isInteger(c.exp) || c.exp <= now || c.exp <= c.iat) return null;
    return c;
  } catch { return null; }
}
export async function active(c) {
  const url = process.env.MARKETPLACE_LAUNCH_VERIFY_URL?.trim();
  const key = process.env.MARKETPLACE_LAUNCH_VERIFY_SECRET?.trim();
  if (!url || !key || Buffer.byteLength(key) < 32) return false;
  try {
    const r = await fetch(url, { method: 'POST', headers: { 'content-type': 'application/json', authorization: `Bearer ${key}` }, body: JSON.stringify({ userId: c.user_id, installId: c.install_id, toolId: c.tool_id, issuedAt: c.iat }), cache: 'no-store', signal: AbortSignal.timeout(5000) });
    return r.ok && (await r.json()).active === true;
  } catch { return false; }
}
export const cookieName = 'minutes_session';
