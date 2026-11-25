// Restriction optionnelle de l'admin à une liste d'IP. Répond 404 pour ne pas révéler l'existence de l'admin.
import { config } from '../config.js';

export function ipAllowlist(req, res, next) {
  if (!config.adminIpAllowlist.length) return next();
  const ip = (req.ip || '').replace(/^::ffff:/, '');
  if (config.adminIpAllowlist.includes(ip)) return next();
  res.status(404).type('text').send('Not found');
}
