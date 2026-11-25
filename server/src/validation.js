// Schémas de validation (zod) : toute donnée entrante est filtrée, bornée et typée avant d'atteindre la base.
import { z } from 'zod';

const clean = (max) => z.string().trim().max(max).transform(s => s.replace(/[\u0000-\u001F\u007F]/g, ''));
const optional = (max) => clean(max).optional().transform(v => (v ? v : null));

export const leadSchema = z.object({
  nom: clean(120).pipe(z.string().min(2, 'Nom trop court')),
  fonction: optional(120),
  societe: clean(160).pipe(z.string().min(2, 'Société requise')),
  pays: clean(80).pipe(z.string().min(2, 'Pays requis')),
  ville: optional(80),
  categories: optional(255),
  pdv: z.union([z.string(), z.number()]).optional().transform(v => (v === '' || v == null ? null : Number(v)))
    .pipe(z.number().int().min(0).max(10_000_000).nullable()),
  zones: optional(255),
  tel: clean(30).pipe(z.string().regex(/^[+\d][\d\s().-]{7,29}$/, 'Téléphone invalide')),
  email: clean(160).pipe(z.string().email('E-mail invalide')),
  website: z.string().max(0).optional(), // pot de miel anti-robots : doit rester vide
}).strict();

export const loginSchema = z.object({
  email: z.string().trim().email().max(160),
  password: z.string().min(1).max(256),
}).strict();

export const totpSchema = z.object({ code: z.string().regex(/^\d{6}$/) }).strict();

export const STATUSES = ['nouveau', 'en_cours', 'retenu', 'refuse'];

export const leadUpdateSchema = z.object({
  status: z.enum(STATUSES).optional(),
  note: z.string().max(4000).optional(),
}).strict().refine(v => v.status !== undefined || v.note !== undefined, 'Rien à modifier');

export const listSchema = z.object({
  status: z.enum(STATUSES).optional(),
  q: z.string().trim().max(100).optional(),
  page: z.coerce.number().int().min(1).max(100000).default(1),
  pageSize: z.coerce.number().int().min(5).max(100).default(20),
});

export const passwordSchema = z.object({
  current: z.string().min(1).max(256),
  next: z.string().min(12, '12 caractères minimum').max(256)
    .regex(/[a-z]/, 'une minuscule').regex(/[A-Z]/, 'une majuscule').regex(/\d/, 'un chiffre').regex(/[^A-Za-z0-9]/, 'un caractère spécial'),
}).strict();

export const idParam = z.coerce.number().int().positive().max(Number.MAX_SAFE_INTEGER);
