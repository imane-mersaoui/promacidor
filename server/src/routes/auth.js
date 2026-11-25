// Authentification en deux étapes : mot de passe (Argon2id) puis code 2FA (TOTP). Verrouillage après échecs répétés.
import { Router } from 'express';
import { hash, verify } from '@node-rs/argon2';
import { query } from '../db.js';
import { loginSchema, totpSchema } from '../validation.js';
import { loginLimiter } from '../security/rateLimits.js';
import { decrypt } from '../security/crypto.js';
import { verifyTotp } from '../security/totp.js';
import { issueCsrf } from '../security/csrf.js';
import { audit } from '../services/audit.js';

const router = Router();
const MAX_FAILS = 5;
const LOCK_MS = 15 * 60 * 1000;
const PENDING_MS = 5 * 60 * 1000;
// Hash factice : si l'e-mail n'existe pas, on vérifie quand même un hash pour que le temps de réponse soit identique.
const DUMMY = await hash('promasidor-dummy-password-' + Math.random());

const fail = (res) => res.status(401).json({ error: 'Identifiants incorrects.' });
const regenerate = (req) => new Promise((ok, ko) => req.session.regenerate(e => (e ? ko(e) : ok())));

// Jeton CSRF disponible avant connexion (requis pour POST /login et /2fa).
router.get('/csrf', (req, res) => res.json({ csrf: issueCsrf(req) }));

router.post('/login', loginLimiter, async (req, res, next) => {
  try {
    const parsed = loginSchema.safeParse(req.body);
    if (!parsed.success) return fail(res);
    const { email, password } = parsed.data;
    const { rows } = await query('SELECT * FROM admin_users WHERE email=$1', [email]);
    const u = rows[0];

    if (u?.locked_until && new Date(u.locked_until) > new Date()) {
      await verify(DUMMY, password).catch(() => {});
      await audit(req, 'login.locked', email);
      return res.status(423).json({ error: 'Compte temporairement verrouillé. Réessayez plus tard.' });
    }

    const ok = await verify(u?.password_hash || DUMMY, password).catch(() => false);
    if (!u || !ok || !u.is_active) {
      if (u) {
        const fails = u.failed_attempts + 1;
        await query('UPDATE admin_users SET failed_attempts=$1, locked_until=$2 WHERE id=$3',
          [fails >= MAX_FAILS ? 0 : fails, fails >= MAX_FAILS ? new Date(Date.now() + LOCK_MS) : null, u.id]);
      }
      await audit(req, 'login.fail', email);
      return fail(res);
    }

    // Étape 1 validée : nouvelle session (anti-fixation), en attente du code 2FA.
    await regenerate(req);
    req.session.pending = { uid: u.id, at: Date.now() };
    issueCsrf(req);
    res.json({ step: '2fa', csrf: req.session.csrf });
  } catch (err) { next(err); }
});

router.post('/2fa', loginLimiter, async (req, res, next) => {
  try {
    const p = req.session.pending;
    if (!p || Date.now() - p.at > PENDING_MS) {
      delete req.session.pending;
      return res.status(401).json({ error: 'Délai dépassé. Reconnectez-vous.' });
    }
    const parsed = totpSchema.safeParse(req.body);
    const { rows } = await query('SELECT * FROM admin_users WHERE id=$1 AND is_active', [p.uid]);
    const u = rows[0];
    const counter = parsed.success && u ? verifyTotp(decrypt(u.totp_secret_enc), parsed.data.code, Number(u.totp_last_counter)) : null;

    if (counter === null) {
      p.tries = (p.tries || 0) + 1;
      await audit(req, 'login.2fa_fail', u?.email);
      if (p.tries >= 5) { delete req.session.pending; return res.status(401).json({ error: 'Trop d’essais. Reconnectez-vous.' }); }
      return res.status(401).json({ error: 'Code incorrect.' });
    }

    await query('UPDATE admin_users SET totp_last_counter=$1, failed_attempts=0, locked_until=NULL, last_login_at=now() WHERE id=$2', [counter, u.id]);
    await regenerate(req);
    Object.assign(req.session, { uid: u.id, role: u.role, mfa: true, authAt: Date.now(), lastSeen: Date.now() });
    issueCsrf(req);
    await audit(req, 'login.success', u.email);
    res.json({ ok: true, csrf: req.session.csrf, user: { name: u.name, email: u.email, role: u.role } });
  } catch (err) { next(err); }
});

router.post('/logout', async (req, res) => {
  await audit(req, 'logout');
  req.session.destroy(() => {
    res.clearCookie(req.app.get('sessionCookieName'), { path: '/' });
    res.json({ ok: true });
  });
});

export default router;
