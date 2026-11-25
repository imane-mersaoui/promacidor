// Pool PostgreSQL. Toutes les requêtes sont paramétrées ($1, $2…) : aucune concaténation de SQL.
import pg from 'pg';
import { config } from './config.js';

export const pool = new pg.Pool({
  connectionString: config.DATABASE_URL,
  max: 10,
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 5_000,
  statement_timeout: 10_000,
});

pool.on('error', err => console.error('Erreur PostgreSQL inattendue :', err.message));

export const query = (text, params) => pool.query(text, params);
