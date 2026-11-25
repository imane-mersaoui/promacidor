// API publique : réception des demandes de partenariat envoyées par le formulaire du site.
import { Router } from 'express';
import { query } from '../db.js';
import { leadSchema } from '../validation.js';
import { hashIp } from '../security/crypto.js';
import { formLimiter } from '../security/rateLimits.js';

const router = Router();

router.post('/partenaires', formLimiter, async (req, res, next) => {
  try {
    if (!req.is('application/json')) return res.status(415).json({ error: 'Format non supporté.' });
    const parsed = leadSchema.safeParse(req.body);
    if (!parsed.success) {
      // Pot de miel rempli : on répond « OK » sans rien enregistrer pour ne pas renseigner le robot.
      if (parsed.error.issues.some(i => i.path[0] === 'website')) return res.status(201).json({ ok: true });
      return res.status(400).json({ error: 'Certains champs sont invalides.', fields: [...new Set(parsed.error.issues.map(i => i.path[0]))] });
    }
    const d = parsed.data;
    await query(
      `INSERT INTO leads (nom, fonction, societe, pays, ville, categories, points_vente, zones, telephone, email, ip_hash, user_agent)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)`,
      [d.nom, d.fonction, d.societe, d.pays, d.ville, d.categories, d.pdv, d.zones, d.tel, d.email,
        hashIp(req.ip), (req.get('user-agent') || '').slice(0, 255)],
    );
    res.status(201).json({ ok: true });
  } catch (err) { next(err); }
});

export default router;
