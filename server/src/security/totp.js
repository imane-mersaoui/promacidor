// TOTP (RFC 6238) implémenté avec le module crypto de Node : aucune dépendance externe.
// Compatible Google Authenticator, Microsoft Authenticator, Authy, 2FAS…
import crypto from 'node:crypto';

const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
const STEP = 30;
const DIGITS = 6;

export function generateSecret(bytes = 20) {
  const buf = crypto.randomBytes(bytes);
  let bits = '', out = '';
  for (const b of buf) bits += b.toString(2).padStart(8, '0');
  for (let i = 0; i + 5 <= bits.length; i += 5) out += ALPHABET[parseInt(bits.slice(i, i + 5), 2)];
  return out;
}

function base32Decode(str) {
  let bits = '';
  for (const c of str.replace(/=+$/, '').toUpperCase()) {
    const v = ALPHABET.indexOf(c);
    if (v < 0) throw new Error('Secret TOTP invalide');
    bits += v.toString(2).padStart(5, '0');
  }
  const bytes = [];
  for (let i = 0; i + 8 <= bits.length; i += 8) bytes.push(parseInt(bits.slice(i, i + 8), 2));
  return Buffer.from(bytes);
}

function codeAt(secret, counter) {
  const buf = Buffer.alloc(8);
  buf.writeBigUInt64BE(BigInt(counter));
  const h = crypto.createHmac('sha1', base32Decode(secret)).update(buf).digest();
  const o = h[h.length - 1] & 0xf;
  const n = ((h[o] & 0x7f) << 24) | (h[o + 1] << 16) | (h[o + 2] << 8) | h[o + 3];
  return String(n % 10 ** DIGITS).padStart(DIGITS, '0');
}

/**
 * Vérifie un code avec une tolérance de ±1 pas (±30 s).
 * Retourne le compteur utilisé (pour refuser la réutilisation du même code) ou null.
 */
export function verifyTotp(secret, token, lastUsedCounter = -1) {
  if (!/^\d{6}$/.test(String(token))) return null;
  const now = Math.floor(Date.now() / 1000 / STEP);
  for (const c of [now - 1, now, now + 1]) {
    if (c <= lastUsedCounter) continue; // anti-rejeu
    if (crypto.timingSafeEqual(Buffer.from(codeAt(secret, c)), Buffer.from(String(token)))) return c;
  }
  return null;
}

export const otpauthUrl = (secret, account, issuer = 'Promasidor Admin') =>
  `otpauth://totp/${encodeURIComponent(issuer)}:${encodeURIComponent(account)}?secret=${secret}&issuer=${encodeURIComponent(issuer)}&algorithm=SHA1&digits=${DIGITS}&period=${STEP}`;

export const _codeAt = codeAt; // utilisé uniquement pour les tests
