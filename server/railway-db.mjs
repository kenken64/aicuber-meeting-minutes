import { DatabaseSync } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';

let instance;
export function database() {
  if (instance) return instance;
  const path = process.env.MINUTES_DB_PATH || './data/minutes.sqlite';
  mkdirSync(dirname(path), { recursive: true });
  const db = new DatabaseSync(path);
  db.exec(`PRAGMA journal_mode=WAL; PRAGMA busy_timeout=5000;
    CREATE TABLE IF NOT EXISTS zoom_connections (owner_id TEXT PRIMARY KEY NOT NULL, zoom_user_id TEXT NOT NULL, display_name TEXT NOT NULL, email TEXT NOT NULL, token_cipher TEXT NOT NULL, expires_at INTEGER NOT NULL, refresh_owner TEXT, refresh_until INTEGER);
    CREATE INDEX IF NOT EXISTS zoom_user_index ON zoom_connections (zoom_user_id);
    CREATE TABLE IF NOT EXISTS zoom_oauth_states (state_hash TEXT PRIMARY KEY NOT NULL, owner_id TEXT NOT NULL, browser_hash TEXT NOT NULL, expires_at INTEGER NOT NULL);`);
  const prepare = sql => ({ bind(...values) { return {
    first: async () => db.prepare(sql).get(...values) || null,
    run: async () => db.prepare(sql).run(...values),
    runSync: () => db.prepare(sql).run(...values),
  }; } });
  instance = { prepare, batch: async statements => {
    db.exec('BEGIN');
    try { const results = []; for (const statement of statements) results.push(statement.runSync()); db.exec('COMMIT'); return results; }
    catch (error) { db.exec('ROLLBACK'); throw error; }
  } };
  return instance;
}
