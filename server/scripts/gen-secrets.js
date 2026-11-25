// Génère des secrets forts à copier dans .env
import crypto from 'node:crypto';
console.log(`SESSION_SECRET=${crypto.randomBytes(48).toString('base64url')}`);
console.log(`ENCRYPTION_KEY=${crypto.randomBytes(32).toString('hex')}`);
console.log(`IP_HASH_SALT=${crypto.randomBytes(24).toString('base64url')}`);
console.log(`ADMIN_PATH=/gestion-${crypto.randomBytes(6).toString('hex')}`);
