// All meeting content remains in this browser. Only non-secret content enters DuckDB.
let database, connection, worker, releaseLock, currentKey, queue = Promise.resolve();
export const cacheState = { status: 'idle', error: '', key: null };
const enqueue = task => { const result = queue.then(task); queue = result.catch(() => {}); return result; };
const parseRows = table => table.toArray().map(row => ({ ...row }));
async function parameterQuery(sql, values) { const statement = await connection.prepare(sql); try { return await statement.query(...values); } finally { await statement.close(); } }
async function closeDatabase() {
  try { if (connection) { await connection.query('CHECKPOINT'); await connection.close(); } } catch { /* Closing still releases the file handle. */ }
  try { if (database && connection) await database.dropFiles(); } finally { worker?.terminate(); releaseLock?.(); connection = database = worker = releaseLock = null; currentKey = null; }
}
async function lockFile(name) {
  if (!navigator.locks) return;
  await new Promise((resolve, reject) => {
    navigator.locks.request(name, { ifAvailable: true }, async lock => {
      if (!lock) { reject(new Error('This account’s cache is open in another tab. Close that tab, then retry.')); return; }
      await new Promise(release => { releaseLock = release; resolve(); });
    }).catch(reject);
  });
}
export const meetingCache = {
  open(key = 'local') { return enqueue(async () => {
    if (!/^[A-Za-z0-9_-]{1,80}$/.test(key)) throw new Error('Invalid cache workspace.');
    if (currentKey === key && connection) return;
    await closeDatabase(); cacheState.status = 'loading'; cacheState.error = ''; cacheState.key = key;
    try {
      if (!navigator.storage?.getDirectory) throw new Error('This browser does not provide persistent file storage. Use a current Chrome, Edge, Safari, or Firefox browser.');
      await lockFile('minutes-duckdb-' + key);
      const duckdb = await import('@duckdb/duckdb-wasm');
      const response = await fetch('/duckdb/duckdb-eh-1.32.0.wasm.gz');
      if (!response.ok) throw new Error('The browser database engine could not be downloaded. Please retry.');
      let bytes = new Uint8Array(await response.arrayBuffer());
      if (bytes[0] === 0x1f && bytes[1] === 0x8b) bytes = new Uint8Array(await new Response(new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'))).arrayBuffer());
      const wasmUrl = URL.createObjectURL(new Blob([bytes], { type: 'application/wasm' }));
      worker = new Worker('/duckdb/duckdb-browser-eh-1.32.0.worker.js');
      database = new duckdb.AsyncDuckDB(new duckdb.VoidLogger(), worker);
      let timeout;
      try { await Promise.race([database.instantiate(wasmUrl), new Promise((_, reject) => { timeout = setTimeout(() => reject(new Error('The browser database engine did not start. Please retry.')), 30000); })]); } finally { clearTimeout(timeout); URL.revokeObjectURL(wasmUrl); }
      await database.open({ path: `opfs://minutes-${key}.duckdb`, accessMode: duckdb.DuckDBAccessMode.READ_WRITE, opfs: { fileHandling: 'auto' } });
      connection = await database.connect();
      await connection.query(`CREATE TABLE IF NOT EXISTS meetings (id VARCHAR PRIMARY KEY, title VARCHAR, kind VARCHAR, start_time VARCHAR, payload VARCHAR, saved_at VARCHAR);
        CREATE TABLE IF NOT EXISTS minutes (id VARCHAR PRIMARY KEY, meeting_id VARCHAR, title VARCHAR, content VARCHAR, saved_at VARCHAR);
        CREATE TABLE IF NOT EXISTS analyses (id VARCHAR PRIMARY KEY, minutes_id VARCHAR, title VARCHAR, payload VARCHAR, saved_at VARCHAR);
        CREATE TABLE IF NOT EXISTS cache_meta (key VARCHAR PRIMARY KEY, value VARCHAR);
        INSERT OR IGNORE INTO cache_meta VALUES ('schema_version', '1'); CHECKPOINT;`);
      currentKey = key; cacheState.status = 'ready';
    } catch (error) { await closeDatabase(); cacheState.status = 'error'; cacheState.error = error.message || 'Browser storage could not be opened.'; throw error; }
  }); },
  close() { return enqueue(async () => { await closeDatabase(); cacheState.status = 'idle'; cacheState.key = null; }); },
  saveMeetings(meetings) { return enqueue(async () => {
    if (!connection) throw new Error('The browser cache is unavailable.');
    const statement = await connection.prepare('INSERT OR REPLACE INTO meetings VALUES (?, ?, ?, ?, ?, ?)');
    try { await connection.query('BEGIN TRANSACTION'); for (const m of meetings) await statement.query(`${m.kind}:${m.uuid}`, m.topic, m.kind, m.startTime || '', JSON.stringify(m), new Date().toISOString()); await connection.query('COMMIT'); await connection.query('CHECKPOINT'); } catch (error) { await connection.query('ROLLBACK').catch(() => {}); throw error; } finally { await statement.close(); }
  }); },
  saveMinutes({ id, meetingId = '', title, text }) { return enqueue(async () => { if (!connection) throw new Error('The browser cache is unavailable.'); await parameterQuery('INSERT OR REPLACE INTO minutes VALUES (?, ?, ?, ?, ?)', [id, meetingId, title, text, new Date().toISOString()]); await connection.query('CHECKPOINT'); }); },
  saveAnalysis({ id, minutesId, title, result }) { return enqueue(async () => { if (!connection) throw new Error('The browser cache is unavailable.'); await parameterQuery('INSERT OR REPLACE INTO analyses VALUES (?, ?, ?, ?, ?)', [id, minutesId, title, JSON.stringify(result), new Date().toISOString()]); await connection.query('CHECKPOINT'); }); },
  seed({ minutes, transcript, review }) { return enqueue(async () => {
    if (!connection) return;
    const now = new Date().toISOString();
    await parameterQuery('INSERT OR IGNORE INTO minutes VALUES (?, ?, ?, ?, ?)', ['source:summary', 'source:2026-10-14', '14 Oct 2026 · Meeting summary', minutes, now]);
    await parameterQuery('INSERT OR IGNORE INTO minutes VALUES (?, ?, ?, ?, ?)', ['source:transcript', 'source:2026-10-14', '14–15 Oct 2026 · Full Zoom transcript', transcript, now]);
    await parameterQuery('INSERT OR IGNORE INTO analyses VALUES (?, ?, ?, ?, ?)', ['source:review', 'source:transcript', '14 Oct 2026 · Full meeting and storybook review', JSON.stringify(review), now]);
    await connection.query('CHECKPOINT');
  }); },
  list(search = '') { return enqueue(async () => {
    if (!connection) throw new Error('The browser cache is unavailable.');
    const rows = await parameterQuery(`SELECT 'meeting' AS type, id, title, saved_at FROM meetings WHERE contains(lower(title), lower(?))
      UNION ALL SELECT 'minutes', id, title, saved_at FROM minutes WHERE contains(lower(title || ' ' || content), lower(?))
      UNION ALL SELECT 'analysis', id, title, saved_at FROM analyses WHERE contains(lower(title || ' ' || payload), lower(?)) ORDER BY saved_at DESC`, [search, search, search]);
    return parseRows(rows);
  }); },
  read(type, id) { return enqueue(async () => {
    if (!connection) throw new Error('The browser cache is unavailable.');
    const tables = { meeting: 'meetings', minutes: 'minutes', analysis: 'analyses' }; if (!tables[type]) throw new Error('Invalid cache item.');
    const rows = parseRows(await parameterQuery(`SELECT * FROM ${tables[type]} WHERE id = ?`, [id])); const row = rows[0]; if (row?.payload) row.data = JSON.parse(row.payload); return row;
  }); },
  meetings() { return enqueue(async () => { if (!connection) return []; return parseRows(await connection.query('SELECT payload FROM meetings ORDER BY start_time DESC')).map(row => JSON.parse(row.payload)); }); },
  stats() { return enqueue(async () => { if (!connection) return { meetings: 0, minutes: 0, analyses: 0 }; const row = parseRows(await connection.query('SELECT (SELECT count(*) FROM meetings) AS meetings, (SELECT count(*) FROM minutes) AS minutes, (SELECT count(*) FROM analyses) AS analyses'))[0]; return { meetings: Number(row.meetings), minutes: Number(row.minutes), analyses: Number(row.analyses) }; }); },
  clear() { return enqueue(async () => { if (!connection) throw new Error('The browser cache is unavailable.'); await connection.query('BEGIN TRANSACTION; DELETE FROM meetings; DELETE FROM minutes; DELETE FROM analyses; COMMIT; CHECKPOINT;'); }); },
  export() { return enqueue(async () => {
    if (!connection) throw new Error('The browser cache is unavailable.'); await connection.query('CHECKPOINT');
    // Export from SQL so the live OPFS handle never has to be opened a second time.
    const backup = { format: 'minutes-duckdb-cache', version: 1, exportedAt: new Date().toISOString() };
    for (const table of ['meetings', 'minutes', 'analyses']) backup[table] = parseRows(await connection.query(`SELECT * FROM ${table}`));
    return backup;
  }); },
};
export async function contentId(text) { return [...new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text)))].map(b => b.toString(16).padStart(2, '0')).join(''); }
