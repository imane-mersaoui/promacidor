// Applique les migrations SQL du dossier migrations/ (une seule fois chacune).
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { pool } from '../src/db.js';

const dir = path.join(path.dirname(fileURLToPath(import.meta.url)), '../migrations');
const client = await pool.connect();
try {
  await client.query('CREATE TABLE IF NOT EXISTS schema_migrations (name VARCHAR(255) PRIMARY KEY, applied_at TIMESTAMPTZ NOT NULL DEFAULT now())');
  const done = new Set((await client.query('SELECT name FROM schema_migrations')).rows.map(r => r.name));
  for (const f of fs.readdirSync(dir).filter(f => f.endsWith('.sql')).sort()) {
    if (done.has(f)) continue;
    await client.query('BEGIN');
    await client.query(fs.readFileSync(path.join(dir, f), 'utf8'));
    await client.query('INSERT INTO schema_migrations (name) VALUES ($1)', [f]);
    await client.query('COMMIT');
    console.log('Migration appliquée :', f);
  }
  console.log('Base à jour.');
} catch (e) {
  await client.query('ROLLBACK').catch(() => {});
  console.error('Échec de la migration :', e.message);
  process.exitCode = 1;
} finally {
  client.release();
  await pool.end();
}
