// En-têtes de sécurité. Deux politiques CSP : stricte pour l'admin, adaptée au site public.
import helmet from 'helmet';
import { config } from '../config.js';

const base = {
  defaultSrc: ["'self'"],
  baseUri: ["'self'"],
  objectSrc: ["'none'"],
  frameAncestors: ["'none'"],
  formAction: ["'self'"],
  imgSrc: ["'self'", 'data:'],
  fontSrc: ["'self'"],
  connectSrc: ["'self'"],
  ...(config.isProd ? { upgradeInsecureRequests: [] } : {}),
};

const hsts = { maxAge: 63072000, includeSubDomains: true, preload: true };

export const publicHeaders = helmet({
  contentSecurityPolicy: {
    useDefaults: false,
    directives: { ...base, scriptSrc: ["'self'"], styleSrc: ["'self'", "'unsafe-inline'"] }, // attributs style="" du site
  },
  strictTransportSecurity: hsts,
  referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
  crossOriginEmbedderPolicy: false,
});

export const adminHeaders = helmet({
  contentSecurityPolicy: {
    useDefaults: false,
    directives: { ...base, scriptSrc: ["'self'"], styleSrc: ["'self'"] }, // aucun script ni style inline
  },
  strictTransportSecurity: hsts,
  referrerPolicy: { policy: 'no-referrer' },
});

// L'admin ne doit jamais être indexé ni mis en cache.
export function noStore(req, res, next) {
  res.set({
    'Cache-Control': 'no-store, no-cache, must-revalidate, private',
    Pragma: 'no-cache',
    'X-Robots-Tag': 'noindex, nofollow, noarchive',
    'Permissions-Policy': 'camera=(), microphone=(), geolocation=(), payment=()',
  });
  next();
}
