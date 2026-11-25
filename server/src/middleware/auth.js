// Contrôle d'accès : session authentifiée (mot de passe + 2FA), expiration par inactivité, rôles.
import { query } from '../db.js';

const IDLE_MS = 30 * 60 * 1000;       // déconnexion après 30 min d'inactivité
const ABSOLUTE_MS = 8 * 60 * 60 * 1000; // et au plus tard 8 h après la connexion

export async function requireAuth(req, res, next) {
  const s = req.session;
  if (!s?.uid || !s.mfa) return res.status(401).json({ error: 'Authentification requise.' });
  const now = Date.now();
  if (now - (s.lastSeen || 0) > IDLE_MS || now - (s.authAt || 0) > ABSOLUTE_MS) {
    return s.destroy(() => res.status(401).json({ error: 'Session expirée. Reconnectez-vous.' }));
  }
  // Le compte doit toujours exister, être actif, et le mot de passe ne pas avoir changé depuis la connexion.
  const { rows } = await query('SELECT id, role, is_active, password_changed_at FROM admin_users WHERE id=$1', [s.uid]);
  const u = rows[0];
  if (!u || !u.is_active || new Date(u.password_changed_at).getTime() > s.authAt) {
    return s.destroy(() => res.status(401).json({ error: 'Session révoquée.' }));
  }
  s.role = u.role;
  s.lastSeen = now;
  next();
}

export const requireRole = (...roles) => (req, res, next) =>
  roles.includes(req.session.role) ? next() : res.status(403).json({ error: 'Droits insuffisants.' });
