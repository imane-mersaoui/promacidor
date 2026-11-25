// Limitation de débit : bloque le spam du formulaire et les attaques par force brute.
import rateLimit from 'express-rate-limit';

const common = { standardHeaders: 'draft-7', legacyHeaders: false };

export const formLimiter = rateLimit({
  ...common, windowMs: 60 * 60 * 1000, limit: 5,
  message: { error: 'Trop de demandes envoyées. Réessayez dans une heure.' },
});

export const loginLimiter = rateLimit({
  ...common, windowMs: 15 * 60 * 1000, limit: 10, skipSuccessfulRequests: true,
  message: { error: 'Trop de tentatives. Réessayez dans 15 minutes.' },
});

export const adminApiLimiter = rateLimit({
  ...common, windowMs: 60 * 1000, limit: 120,
  message: { error: 'Trop de requêtes.' },
});
