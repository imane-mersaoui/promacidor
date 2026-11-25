# Promasidor — Espace d'administration

Le site public reste un site statique (`index.html`, `css/`, `js/`, `assets/`).
Le dossier `server/` ajoute une API Node.js qui :

- reçoit les demandes du formulaire « Devenez notre partenaire » ;
- les enregistre dans PostgreSQL ;
- les rend consultables dans un espace d'administration sécurisé, servi depuis `admin/`.

> ⚠️ GitHub Pages ne sait pas faire tourner de serveur. Sur `github.io`, le formulaire reste en mode démo et rien n'est envoyé.
> L'admin et l'enregistrement des demandes fonctionnent une fois le projet installé sur le VPS.

## Architecture

```
promacidor/
├── index.html, css/, js/, assets/   Site public
├── admin/                           Interface d'administration (HTML/CSS/JS, aucun script inline)
├── server/
│   ├── src/
│   │   ├── app.js                   Assemblage Express : site, API publique, admin
│   │   ├── config.js                Configuration validée au démarrage
│   │   ├── db.js                    Pool PostgreSQL (requêtes paramétrées uniquement)
│   │   ├── validation.js            Schémas zod de toutes les entrées
│   │   ├── routes/                  public.js · auth.js · admin.js
│   │   ├── middleware/              auth.js (session + rôles) · ipAllowlist.js
│   │   ├── security/                headers · csrf · rateLimits · crypto · totp
│   │   └── services/audit.js        Journal d'audit
│   ├── migrations/001_init.sql
│   └── scripts/                     migrate · create-user · gen-secrets
└── deploy/                          Nginx, systemd, sauvegardes
```

## Mesures de sécurité

| Menace | Protection |
|---|---|
| Vol de mot de passe | Argon2id + **2FA obligatoire** (TOTP, codes à usage unique, anti-rejeu) |
| Force brute | Limitation de débit (Nginx + Node), verrouillage du compte 15 min après 5 échecs, temps de réponse constant |
| Vol de session | Cookie `__Host-` HttpOnly, Secure, SameSite=Strict ; session régénérée à chaque étape ; expiration après 30 min d'inactivité et 8 h maximum ; sessions révoquées au changement de mot de passe |
| CSRF | Jeton synchronisé + vérification de l'origine + SameSite=Strict |
| XSS | CSP stricte sans inline sur l'admin ; données affichées uniquement via `textContent` |
| Injection SQL | Requêtes paramétrées, validation zod stricte (champs inconnus refusés) |
| Spam du formulaire | Pot de miel, 5 envois/heure/IP, taille de requête limitée à 10 Ko |
| Découverte de l'admin | Chemin secret (`ADMIN_PATH`), liste d'IP optionnelle (sinon 404), `noindex`, pas de page d'inscription |
| Fuite de données | Secrets 2FA chiffrés AES-256-GCM, IP des visiteurs hachées, export CSV protégé contre l'injection de formules |
| Abus de droits | 3 rôles (admin, éditeur, lecteur) vérifiés côté serveur ; journal d'audit de toutes les actions sensibles |
| Compromission du serveur | Service systemd durci (utilisateur dédié, système en lecture seule), Node écoute uniquement sur 127.0.0.1, PostgreSQL non exposé |

### Droits par rôle

| Action | admin | editeur | lecteur |
|---|:-:|:-:|:-:|
| Voir les demandes et les statistiques | ✅ | ✅ | ✅ |
| Changer le statut, ajouter une note | ✅ | ✅ | — |
| Exporter en CSV | ✅ | ✅ | — |
| Supprimer une demande | ✅ | — | — |
| Consulter le journal d'audit | ✅ | — | — |

## Installation sur le VPS (Ubuntu)

```bash
# 1. Prérequis
sudo apt update && sudo apt install -y nginx postgresql certbot python3-certbot-nginx
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash - && sudo apt install -y nodejs

# 2. Utilisateur système dédié et code
sudo useradd --system --home /var/www/promacidor --shell /usr/sbin/nologin promasidor
sudo git clone https://github.com/imane-mersaoui/promacidor.git /var/www/promacidor
cd /var/www/promacidor/server && sudo npm ci --omit=dev

# 3. Base de données (utilisateur aux droits limités)
sudo -u postgres psql -c "CREATE USER promasidor_app WITH PASSWORD 'UN_MOT_DE_PASSE_LONG_ET_ALEATOIRE';"
sudo -u postgres psql -c "CREATE DATABASE promasidor OWNER promasidor_app;"
sudo -u postgres psql -d promasidor -c "CREATE EXTENSION IF NOT EXISTS citext;"

# 4. Configuration
sudo cp .env.example .env
npm run gen-secrets            # copier les 4 lignes affichées dans .env
sudo nano .env                 # DATABASE_URL, PUBLIC_ORIGIN, ADMIN_PATH…
sudo chown promasidor:promasidor .env && sudo chmod 600 .env

# 5. Tables puis premier compte administrateur (QR code 2FA affiché dans le terminal)
sudo -u promasidor npm run migrate
sudo -u promasidor npm run create-user -- --email imane@dusens.com --name "Imane Mersaoui" --role admin

# 6. Service
sudo cp ../deploy/promasidor.service /etc/systemd/system/
sudo systemctl daemon-reload && sudo systemctl enable --now promasidor

# 7. Nginx + HTTPS
sudo cp ../deploy/promasidor-proxy.conf /etc/nginx/snippets/
sudo cp ../deploy/nginx-promasidor.conf /etc/nginx/sites-available/promasidor
sudo ln -s /etc/nginx/sites-available/promasidor /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx
sudo certbot --nginx -d promasidor-dz.com -d www.promasidor-dz.com

# 8. Pare-feu : seuls SSH, HTTP et HTTPS sont ouverts
sudo ufw allow OpenSSH && sudo ufw allow 'Nginx Full' && sudo ufw enable

# 9. Sauvegarde quotidienne de la base
sudo crontab -u postgres -e     # ajouter : 0 3 * * * /var/www/promacidor/deploy/backup-db.sh
```

L'admin est alors accessible sur `https://www.promasidor-dz.com<ADMIN_PATH>/`.

## Exploitation

- **Ajouter un utilisateur** : `sudo -u promasidor npm run create-user -- --email … --name "…" --role editeur`.
- **Désactiver un compte** : `sudo -u postgres psql -d promasidor -c "UPDATE admin_users SET is_active=false WHERE email='…';"`. Ses sessions sont coupées immédiatement.
- **Téléphone perdu (2FA)** : supprimer le compte, puis le recréer avec `create-user`.
- **Mettre à jour** : `git pull && cd server && npm ci --omit=dev && npm run migrate && sudo systemctl restart promasidor`.
- **Logs** : `journalctl -u promasidor -f`.
- **Dépendances** : lancer `npm audit` chaque mois.

## Règles à respecter

1. Ne jamais committer `server/.env` (déjà exclu par `.gitignore`).
2. Garder `ADMIN_PATH` confidentiel et le changer si l'adresse circule.
3. Si l'équipe a des IP fixes, renseigner `ADMIN_IP_ALLOWLIST` : depuis toute autre IP, l'admin renvoie une page 404.
