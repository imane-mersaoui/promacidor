// Chargement et validation stricte de la configuration : le serveur refuse de démarrer si un secret manque ou est faible.
import 'dotenv/config';
import { z } from 'zod';

const hex64 = z.string().regex(/^[0-9a-f]{64}$/i, 'doit être 64 caractères hexadécimaux (npm run gen-secrets)');

const schema = z.object({
  NODE_ENV: z.enum(['production', 'development', 'test']).default('production'),
  PORT: z.coerce.number().int().min(1).max(65535).default(3000),
  DATABASE_URL: z.string().url(),
  SESSION_SECRET: z.string().min(64, 'au moins 64 caractères'),
  ENCRYPTION_KEY: hex64,
  IP_HASH_SALT: z.string().min(32),
  ADMIN_PATH: z.string().regex(/^\/[a-z0-9-]{8,64}$/, 'format /mon-chemin-secret (8 à 64 caractères a-z, 0-9, -)'),
  ADMIN_IP_ALLOWLIST: z.string().optional().default(''),
  PUBLIC_ORIGIN: z.string().url(),
  TRUST_PROXY: z.coerce.number().int().min(0).max(5).default(1),
});

const parsed = schema.safeParse(process.env);
if (!parsed.success) {
  console.error('Configuration invalide :');
  for (const issue of parsed.error.issues) console.error(`  - ${issue.path.join('.')} : ${issue.message}`);
  process.exit(1);
}

const env = parsed.data;
if (env.ADMIN_PATH === '/gestion-changez-moi' && env.NODE_ENV === 'production') {
  console.error('ADMIN_PATH doit être modifié en production.');
  process.exit(1);
}

export const config = {
  ...env,
  isProd: env.NODE_ENV === 'production',
  adminIpAllowlist: env.ADMIN_IP_ALLOWLIST.split(',').map(s => s.trim()).filter(Boolean),
};
