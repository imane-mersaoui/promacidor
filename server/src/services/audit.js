// Journal d'audit : chaque action sensible est tracée (connexion, échec, modification, export, suppression).
import { query } from '../db.js';

export async function audit(req, action, target = null, details = null) {
  try {
    await query(
      'INSERT INTO audit_log (user_id, action, target, details, ip) VALUES ($1,$2,$3,$4,$5)',
      [req.session?.uid ?? null, action, target, details ? JSON.stringify(details) : null, req.ip?.slice(0, 64) ?? null],
    );
  } catch (err) {
    console.error('Audit impossible :', err.message);
  }
}
