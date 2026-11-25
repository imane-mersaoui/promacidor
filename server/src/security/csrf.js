// Protection CSRF par jeton synchronisé (stocké en session, renvoyé dans l'en-tête X-CSRF-Token).
// S'ajoute aux cookies SameSite=Strict et à la vérification de l'origine.
import { randomToken, safeEqual } from './crypto.js';
import { config } from '../config.js';

const SAFE = new Set(['GET', 'HEAD', 'OPTIONS']);

export function issueCsrf(req) {
  if (!req.session.csrf) req.session.csrf = randomToken();
  return req.session.csrf;
}

export function requireCsrf(req, res, next) {
  if (SAFE.has(req.method)) return next();
  const token = req.get('X-CSRF-Token');
  if (!token || !req.session.csrf || !safeEqual(token, req.session.csrf)) {
    return res.status(403).json({ error: 'Jeton de sécurité invalide. Rechargez la page.' });
  }
  next();
}

// Refuse les requêtes d'écriture venant d'un autre site.
export function requireSameOrigin(req, res, next) {
  if (SAFE.has(req.method)) return next();
  const origin = req.get('Origin');
  if (!origin) return next(); // le jeton CSRF reste exigé
  const allowed = new Set([config.PUBLIC_ORIGIN, `${req.protocol}://${req.get('host')}`]);
  if (!allowed.has(origin)) return res.status(403).json({ error: 'Origine non autorisée.' });
  next();
}
