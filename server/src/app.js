// Application Express : site public, API du formulaire et espace d'administration sécurisé.
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import express from 'express';
import session from 'express-session';
import pgSession from 'connect-pg-simple';
import { config } from './config.js';
import { pool } from './db.js';
import { publicHeaders, adminHeaders, noStore } from './security/headers.js';
import { requireCsrf, requireSameOrigin } from './security/csrf.js';
import { adminApiLimiter } from './security/rateLimits.js';
import { ipAllowlist } from './middleware/ipAllowlist.js';
import publicRoutes from './routes/public.js';
import authRoutes from './routes/auth.js';
import adminRoutes from './routes/admin.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '../..');          // dossier promacidor/
const ADMIN_UI = path.join(ROOT, 'admin');

export function createApp() {
  const app = express();
  app.disable('x-powered-by');
  app.set('trust proxy', config.TRUST_PROXY);

  // ── Site public (seuls index.html, css, js et assets sont exposés : jamais server/, admin/ ni deploy/) ──
  const staticOpts = { dotfiles: 'deny', index: false, fallthrough: true, maxAge: config.isProd ? '7d' : 0 };
  app.use(['/css', '/js', '/assets'], publicHeaders);
  app.use('/css', express.static(path.join(ROOT, 'css'), staticOpts));
  app.use('/js', express.static(path.join(ROOT, 'js'), staticOpts));
  app.use('/assets', express.static(path.join(ROOT, 'assets'), staticOpts));
  app.get('/', publicHeaders, (req, res) => res.sendFile(path.join(ROOT, 'index.html')));

  // ── API publique du formulaire ──
  app.use('/api', publicHeaders, express.json({ limit: '10kb' }), requireSameOrigin, publicRoutes);

  // ── Espace admin : chemin secret + IP autorisées + CSP stricte + aucune mise en cache ──
  const A = config.ADMIN_PATH;
  const cookieName = config.isProd ? '__Host-psid' : 'psid';
  app.set('sessionCookieName', cookieName);
  const PgStore = pgSession(session);
  const adminSession = session({
    name: cookieName,
    store: new PgStore({ pool, tableName: 'user_sessions', pruneSessionInterval: 15 * 60 }),
    secret: config.SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    rolling: true,
    cookie: { httpOnly: true, secure: config.isProd, sameSite: 'strict', path: '/', maxAge: 8 * 60 * 60 * 1000 },
  });

  app.use(A, ipAllowlist, adminHeaders, noStore);
  app.get(A, (req, res, next) => (req.originalUrl.split('?')[0].endsWith('/') ? next() : res.redirect(301, A + '/')));
  app.use(`${A}/api`, adminApiLimiter, express.json({ limit: '20kb' }), adminSession, requireSameOrigin, requireCsrf);
  app.use(`${A}/api/auth`, authRoutes);
  app.use(`${A}/api`, adminRoutes);
  app.use(A, express.static(ADMIN_UI, { dotfiles: 'deny', index: 'index.html', maxAge: 0 }));

  // ── 404 et erreurs : jamais de détail technique côté client ──
  app.use((req, res) => res.status(404).type('text').send('Not found'));
  // eslint-disable-next-line no-unused-vars
  app.use((err, req, res, next) => {
    if (err.type === 'entity.too.large') return res.status(413).json({ error: 'Requête trop volumineuse.' });
    if (err.type === 'entity.parse.failed') return res.status(400).json({ error: 'Requête invalide.' });
    console.error(new Date().toISOString(), req.method, req.originalUrl, err);
    res.status(500).json({ error: 'Erreur interne.' });
  });

  return app;
}
