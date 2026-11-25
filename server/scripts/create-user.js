// Crée un compte d'administration en ligne de commande (aucune page d'inscription n'existe : surface d'attaque réduite).
// Usage : npm run create-user -- --email prenom@dusens.com --name "Prénom Nom" --role admin
import readline from 'node:readline';
import { hash } from '@node-rs/argon2';
import QRCode from 'qrcode';
import { pool } from '../src/db.js';
import { encrypt } from '../src/security/crypto.js';
import { generateSecret, otpauthUrl } from '../src/security/totp.js';
import { passwordSchema } from '../src/validation.js';

const args = Object.fromEntries(process.argv.slice(2).join(' ').split('--').filter(Boolean).map(s => {
  const [k, ...v] = s.trim().split(' '); return [k, v.join(' ').replace(/^"|"$/g, '')];
}));
const email = (args.email || '').toLowerCase();
const name = args.name || email;
const role = args.role || 'lecteur';
if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email) || !['admin', 'editeur', 'lecteur'].includes(role)) {
  console.error('Usage : npm run create-user -- --email x@y.com --name "Nom" --role admin|editeur|lecteur');
  process.exit(1);
}

// Saisie masquée du mot de passe
function ask(q) {
  return new Promise(resolve => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout, terminal: true });
    rl._writeToOutput = s => { if (s.includes(q)) rl.output.write(s); };
    rl.question(q, a => { rl.close(); process.stdout.write('\n'); resolve(a); });
  });
}
const pwd = await ask('Mot de passe (12+ caractères, maj., min., chiffre, spécial) : ');
const check = passwordSchema.safeParse({ current: 'x', next: pwd });
if (!check.success) { console.error('Mot de passe trop faible :', check.error.issues.map(i => i.message).join(', ')); process.exit(1); }
if (pwd !== await ask('Confirmez le mot de passe : ')) { console.error('Les mots de passe ne correspondent pas.'); process.exit(1); }

const secret = generateSecret();
try {
  await pool.query(
    'INSERT INTO admin_users (email, name, password_hash, role, totp_secret_enc) VALUES ($1,$2,$3,$4,$5)',
    [email, name, await hash(pwd), role, encrypt(secret)]);
} catch (e) {
  console.error(e.code === '23505' ? 'Ce compte existe déjà.' : e.message); process.exit(1);
} finally { await pool.end(); }

const url = otpauthUrl(secret, email);
console.log(`\nCompte créé : ${email} (${role})\n`);
console.log('Scannez ce QR code avec Google Authenticator, Microsoft Authenticator ou 2FAS :\n');
console.log(await QRCode.toString(url, { type: 'terminal', small: true }));
console.log(`Ou saisissez la clé manuellement : ${secret}\n`);
console.log('Cette clé ne sera plus jamais affichée. Ne la partagez pas.');
