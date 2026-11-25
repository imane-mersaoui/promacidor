// Outils cryptographiques : chiffrement AES-256-GCM des secrets 2FA, hachage des IP, comparaison en temps constant.
import crypto from 'node:crypto';
import { config } from '../config.js';

const KEY = Buffer.from(config.ENCRYPTION_KEY, 'hex');

export function encrypt(plain) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', KEY, iv);
  const data = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [iv, tag, data].map(b => b.toString('base64')).join('.');
}

export function decrypt(payload) {
  const [iv, tag, data] = payload.split('.').map(s => Buffer.from(s, 'base64'));
  const decipher = crypto.createDecipheriv('aes-256-gcm', KEY, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(data), decipher.final()]).toString('utf8');
}

// On ne stocke jamais l'IP des visiteurs du formulaire en clair : seulement un hachage salé.
export const hashIp = ip => crypto.createHmac('sha256', config.IP_HASH_SALT).update(String(ip || '')).digest('hex').slice(0, 32);

export function safeEqual(a, b) {
  const ba = Buffer.from(String(a)), bb = Buffer.from(String(b));
  return ba.length === bb.length && crypto.timingSafeEqual(ba, bb);
}

export const randomToken = (bytes = 32) => crypto.randomBytes(bytes).toString('base64url');
