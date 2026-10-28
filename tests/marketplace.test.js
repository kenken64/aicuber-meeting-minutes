import test from 'node:test';
import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import { decode, encode, active } from '../server/marketplace.mjs';

process.env.MEETING_MINUTES_SESSION_SECRET = 'a'.repeat(32);
const now = Math.floor(Date.now() / 1000);
const claims = { iss: '2ndBrain.ceo', tool_id: 'meeting-minutes', user_id: 'alice', install_id: 'install', iat: now, exp: now + 300 };
function launch(c) {
  const data = [ { alg: 'HS256', typ: 'JWT' }, c ].map(x => Buffer.from(JSON.stringify(x)).toString('base64url')).join('.');
  return data + '.' + createHmac('sha256', process.env.MEETING_MINUTES_SESSION_SECRET).update(data).digest('base64url');
}
test('signed marketplace launch and session reject tampering, expiry and other tools', () => {
  assert.deepEqual(decode(launch(claims), true), claims);
  assert.deepEqual(decode(encode(claims)), claims);
  assert.equal(decode(launch({ ...claims, tool_id: 'other' }), true), null);
  assert.equal(decode(launch({ ...claims, exp: now - 1 }), true), null);
  assert.equal(decode(launch(claims) + 'x', true), null);
  assert.equal(decode(encode(claims).replace('a', 'b')), null);
});
test('liveness checks fail closed and send the original issue time', async () => {
  delete process.env.MARKETPLACE_LAUNCH_VERIFY_URL;
  assert.equal(await active(claims), false);
  process.env.MARKETPLACE_LAUNCH_VERIFY_URL = 'https://verify.test';
  process.env.MARKETPLACE_LAUNCH_VERIFY_SECRET = 'b'.repeat(32);
  const original = globalThis.fetch;
  try {
    globalThis.fetch = async (_url, options) => {
      assert.deepEqual(JSON.parse(options.body), { userId: 'alice', installId: 'install', toolId: 'meeting-minutes', issuedAt: now });
      return Response.json({ active: true });
    };
    assert.equal(await active(claims), true);
    globalThis.fetch = async () => { throw new Error('offline'); };
    assert.equal(await active(claims), false);
  } finally { globalThis.fetch = original; }
});
