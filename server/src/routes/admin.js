// API d'administration (authentifiée + 2FA + CSRF). Les droits dépendent du rôle : admin, editeur, lecteur.
import { Router } from 'express';
import { hash, verify } from '@node-rs/argon2';
import { query } from '../db.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { listSchema, leadUpdateSchema, idParam, passwordSchema, STATUSES } from '../validation.js';
import { issueCsrf } from '../security/csrf.js';
import { audit } from '../services/audit.js';

const router = Router();
router.use(requireAuth);

router.get('/me', async (req, res) => {
  const { rows } = await query('SELECT name, email, role, last_login_at FROM admin_users WHERE id=$1', [req.session.uid]);
  res.json({ user: rows[0], csrf: issueCsrf(req) });
});

router.get('/stats', async (req, res) => {
  const { rows } = await query(
    `SELECT status, count(*)::int AS n FROM leads GROUP BY status
     UNION ALL SELECT 'total', count(*)::int FROM leads
     UNION ALL SELECT 'semaine', count(*)::int FROM leads WHERE created_at > now() - interval '7 days'`);
  const out = Object.fromEntries([...STATUSES, 'total', 'semaine'].map(k => [k, 0]));
  rows.forEach(r => { out[r.status] = r.n; });
  res.json(out);
});

function buildFilter({ status, q }) {
  const where = [], params = [];
  if (status) { params.push(status); where.push(`status = $${params.length}`); }
  if (q) {
    params.push(`%${q.replace(/[\\%_]/g, m => '\\' + m)}%`);
    const i = params.length;
    where.push(`(nom ILIKE $${i} OR societe ILIKE $${i} OR email ILIKE $${i} OR ville ILIKE $${i} OR pays ILIKE $${i} OR telephone ILIKE $${i})`);
  }
  return { sql: where.length ? 'WHERE ' + where.join(' AND ') : '', params };
}

router.get('/leads', async (req, res) => {
  const parsed = listSchema.safeParse(req.query);
  if (!parsed.success) return res.status(400).json({ error: 'Paramètres invalides.' });
  const { page, pageSize } = parsed.data;
  const f = buildFilter(parsed.data);
  const total = (await query(`SELECT count(*)::int AS n FROM leads ${f.sql}`, f.params)).rows[0].n;
  const { rows } = await query(
    `SELECT id, nom, fonction, societe, pays, ville, telephone, email, status, created_at
     FROM leads ${f.sql} ORDER BY created_at DESC LIMIT $${f.params.length + 1} OFFSET $${f.params.length + 2}`,
    [...f.params, pageSize, (page - 1) * pageSize]);
  res.json({ total, page, pageSize, items: rows });
});

router.get('/leads/export.csv', requireRole('admin', 'editeur'), async (req, res) => {
  const parsed = listSchema.safeParse(req.query);
  if (!parsed.success) return res.status(400).json({ error: 'Paramètres invalides.' });
  const f = buildFilter(parsed.data);
  const { rows } = await query(
    `SELECT id, created_at, status, nom, fonction, societe, pays, ville, categories, points_vente, zones, telephone, email, note
     FROM leads ${f.sql} ORDER BY created_at DESC LIMIT 50000`, f.params);
  // Protection contre l'injection de formules Excel (=, +, -, @) et échappement CSV.
  const cell = v => {
    let s = v == null ? '' : (v instanceof Date ? v.toISOString() : String(v));
    if (/^[=+\-@\t\r]/.test(s)) s = "'" + s;
    return '"' + s.replace(/"/g, '""') + '"';
  };
  const head = ['ID', 'Date', 'Statut', 'Nom', 'Fonction', 'Société', 'Pays', 'Ville', 'Catégories', 'Points de vente', 'Zones', 'Téléphone', 'E-mail', 'Note'];
  const csv = '\uFEFF' + [head.map(cell).join(';'), ...rows.map(r => Object.values(r).map(cell).join(';'))].join('\r\n');
  await audit(req, 'leads.export', null, { count: rows.length, filtre: parsed.data });
  res.set({ 'Content-Type': 'text/csv; charset=utf-8', 'Content-Disposition': `attachment; filename="partenaires-${new Date().toISOString().slice(0, 10)}.csv"` });
  res.send(csv);
});

router.get('/leads/:id', async (req, res) => {
  const id = idParam.safeParse(req.params.id);
  if (!id.success) return res.status(400).json({ error: 'Identifiant invalide.' });
  const { rows } = await query('SELECT id, nom, fonction, societe, pays, ville, categories, points_vente, zones, telephone, email, status, note, created_at, updated_at FROM leads WHERE id=$1', [id.data]);
  if (!rows[0]) return res.status(404).json({ error: 'Demande introuvable.' });
  res.json(rows[0]);
});

router.patch('/leads/:id', requireRole('admin', 'editeur'), async (req, res) => {
  const id = idParam.safeParse(req.params.id);
  const body = leadUpdateSchema.safeParse(req.body);
  if (!id.success || !body.success) return res.status(400).json({ error: 'Données invalides.' });
  const { status, note } = body.data;
  const { rows } = await query(
    `UPDATE leads SET status=COALESCE($1,status), note=COALESCE($2,note), updated_at=now() WHERE id=$3 RETURNING id, status, note, updated_at`,
    [status ?? null, note ?? null, id.data]);
  if (!rows[0]) return res.status(404).json({ error: 'Demande introuvable.' });
  await audit(req, 'lead.update', `lead:${id.data}`, { status, note: note !== undefined });
  res.json(rows[0]);
});

router.delete('/leads/:id', requireRole('admin'), async (req, res) => {
  const id = idParam.safeParse(req.params.id);
  if (!id.success) return res.status(400).json({ error: 'Identifiant invalide.' });
  const { rowCount } = await query('DELETE FROM leads WHERE id=$1', [id.data]);
  if (!rowCount) return res.status(404).json({ error: 'Demande introuvable.' });
  await audit(req, 'lead.delete', `lead:${id.data}`);
  res.json({ ok: true });
});

router.get('/audit', requireRole('admin'), async (req, res) => {
  const { rows } = await query(
    `SELECT a.id, a.action, a.target, a.ip, a.created_at, u.email AS user
     FROM audit_log a LEFT JOIN admin_users u ON u.id = a.user_id ORDER BY a.created_at DESC LIMIT 200`);
  res.json(rows);
});

router.post('/account/password', async (req, res) => {
  const parsed = passwordSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Mot de passe trop faible : ' + parsed.error.issues.map(i => i.message).join(', ') + '.' });
  const { rows } = await query('SELECT password_hash FROM admin_users WHERE id=$1', [req.session.uid]);
  if (!(await verify(rows[0].password_hash, parsed.data.current).catch(() => false))) {
    await audit(req, 'password.change_fail');
    return res.status(400).json({ error: 'Mot de passe actuel incorrect.' });
  }
  await query('UPDATE admin_users SET password_hash=$1, password_changed_at=now() WHERE id=$2', [await hash(parsed.data.next), req.session.uid]);
  await audit(req, 'password.change');
  // Toutes les sessions (y compris celle-ci) sont révoquées : il faut se reconnecter.
  req.session.destroy(() => res.json({ ok: true, relogin: true }));
});

export default router;
