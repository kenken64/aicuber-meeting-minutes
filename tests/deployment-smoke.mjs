// Run after npm run build:railway. Mirrors the files copied into the Docker image.
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { createHmac, randomBytes } from 'node:crypto';
import { cp, mkdtemp, rm } from 'node:fs/promises';
import { createServer } from 'node:http';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { setTimeout as delay } from 'node:timers/promises';

const root = await mkdtemp(join(tmpdir(), 'minutes-deployment-'));
const secret = randomBytes(32).toString('hex');
let verificationCalls = 0;
const verifier = createServer((_request, response) => {
  verificationCalls++;
  response.writeHead(200, { 'content-type': 'application/json' });
  response.end(JSON.stringify({ active: true }));
});
let child;
let logs = '';
async function stop() {
  if (child && child.exitCode === null) {
    const exited = once(child, 'exit');
    child.kill('SIGTERM');
    const timeout = setTimeout(() => child.kill('SIGKILL'), 5000);
    try { await exited; } finally { clearTimeout(timeout); }
  }
}

try {
  await cp('.next/standalone', root, { recursive: true });
  await cp('.next/static', join(root, '.next/static'), { recursive: true });
  await cp('public', join(root, 'public'), { recursive: true });
  verifier.listen(0, '127.0.0.1');
  await once(verifier, 'listening');
  const portProbe = createServer();
  portProbe.listen(0, '127.0.0.1');
  await once(portProbe, 'listening');
  const port = portProbe.address().port;
  await new Promise(resolve => portProbe.close(resolve));
  const base = `http://127.0.0.1:${port}`;
  const dbPath = join(root, 'data/minutes.sqlite');

  async function start() {
    child = spawn(process.execPath, ['server.js'], { cwd: root, env: {
      ...process.env, NODE_ENV: 'production', HOSTNAME: '0.0.0.0', PORT: String(port),
      MINUTES_DB_PATH: dbPath, APP_ORIGIN: base,
      MEETING_MINUTES_SESSION_SECRET: secret,
      MARKETPLACE_LAUNCH_VERIFY_URL: `http://127.0.0.1:${verifier.address().port}`,
      MARKETPLACE_LAUNCH_VERIFY_SECRET: secret,
    }, stdio: ['ignore', 'pipe', 'pipe'] });
    child.on('error', error => { logs += error.message; });
    for (const stream of [child.stdout, child.stderr]) stream.on('data', data => { logs += data; });
    for (let attempt = 0; attempt < 100; attempt++) {
      try {
        const health = await fetch(`${base}/api/health`, { signal: AbortSignal.timeout(1000) });
        assert.equal(health.status, 200);
        assert.deepEqual(await health.json(), { status: 'ok' });
        return;
      } catch { await delay(100); }
      if (child.exitCode !== null) break;
    }
    throw new Error(`Standalone server did not become healthy: ${logs}`);
  }

  await start();
  assert.equal((await fetch(base)).status, 401);
  assert.equal((await fetch(`${base}/api/zoom/session`)).status, 401);
  assert.equal((await fetch(`${base}/api/2ndbrain/launch?launch_token=invalid`)).status, 401);

  const now = Math.floor(Date.now() / 1000);
  const data = [{ alg: 'HS256', typ: 'JWT' }, {
    iss: '2ndBrain.ceo', tool_id: 'meeting-minutes', user_id: 'smoke-test',
    install_id: 'smoke-install', email: 'smoke@example.test', iat: now, exp: now + 300,
  }].map(value => Buffer.from(JSON.stringify(value)).toString('base64url')).join('.');
  const token = `${data}.${createHmac('sha256', secret).update(data).digest('base64url')}`;
  const launch = await fetch(`${base}/api/2ndbrain/launch?launch_token=${token}`, { redirect: 'manual' });
  assert.equal(launch.status, 303);
  const cookie = launch.headers.get('set-cookie').split(';')[0];
  const headers = { cookie };
  const page = await fetch(base, { headers });
  assert.equal(page.status, 200);
  const html = await page.text();
  assert.match(html, /Loading your meeting workspace/);
  const chunk = html.match(/src="([^" ]+\.js)"/)[1];
  for (const path of [chunk, '/duckdb/duckdb-eh-1.32.0.wasm.gz', '/duckdb/duckdb-browser-eh-1.32.0.worker.js', '/pdfjs/pdf.worker.min.mjs', '/sources/documents.json']) {
    const response = await fetch(new URL(path, base), { headers });
    assert.equal(response.status, 200, path);
    assert.ok((await response.arrayBuffer()).byteLength > 0, path);
  }
  assert.ok(verificationCalls > 1);

  await stop();
  const db = new DatabaseSync(dbPath);
  db.exec("CREATE TABLE deployment_probe (value TEXT); INSERT INTO deployment_probe VALUES ('persisted');");
  db.close();
  await start();
  const reopened = new DatabaseSync(dbPath);
  assert.equal(reopened.prepare('SELECT value FROM deployment_probe').get().value, 'persisted');
  reopened.close();
  console.log('Deployment smoke passed: health, access control, marketplace launch, static assets, SQLite restart persistence.');
} finally {
  await stop();
  await new Promise(resolve => verifier.close(resolve));
  await rm(root, { recursive: true, force: true });
}
