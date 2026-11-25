-- Schéma initial — Promasidor partenaires & administration
CREATE EXTENSION IF NOT EXISTS citext;

CREATE TABLE IF NOT EXISTS admin_users (
  id                SERIAL PRIMARY KEY,
  email             CITEXT UNIQUE NOT NULL,
  name              VARCHAR(120) NOT NULL,
  password_hash     TEXT NOT NULL,                       -- Argon2id
  role              VARCHAR(16) NOT NULL CHECK (role IN ('admin','editeur','lecteur')),
  totp_secret_enc   TEXT NOT NULL,                       -- secret 2FA chiffré AES-256-GCM
  totp_last_counter BIGINT NOT NULL DEFAULT -1,          -- anti-rejeu des codes 2FA
  failed_attempts   INTEGER NOT NULL DEFAULT 0,
  locked_until      TIMESTAMPTZ,
  is_active         BOOLEAN NOT NULL DEFAULT TRUE,
  password_changed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_login_at     TIMESTAMPTZ,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS leads (
  id           BIGSERIAL PRIMARY KEY,
  nom          VARCHAR(120) NOT NULL,
  fonction     VARCHAR(120),
  societe      VARCHAR(160) NOT NULL,
  pays         VARCHAR(80)  NOT NULL,
  ville        VARCHAR(80),
  categories   VARCHAR(255),
  points_vente INTEGER CHECK (points_vente IS NULL OR points_vente BETWEEN 0 AND 10000000),
  zones        VARCHAR(255),
  telephone    VARCHAR(30)  NOT NULL,
  email        VARCHAR(160) NOT NULL,
  status       VARCHAR(16)  NOT NULL DEFAULT 'nouveau' CHECK (status IN ('nouveau','en_cours','retenu','refuse')),
  note         TEXT,
  ip_hash      CHAR(32),
  user_agent   VARCHAR(255),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS leads_status_idx  ON leads (status);
CREATE INDEX IF NOT EXISTS leads_created_idx ON leads (created_at DESC);

CREATE TABLE IF NOT EXISTS audit_log (
  id         BIGSERIAL PRIMARY KEY,
  user_id    INTEGER REFERENCES admin_users(id) ON DELETE SET NULL,
  action     VARCHAR(48) NOT NULL,
  target     VARCHAR(80),
  details    JSONB,
  ip         VARCHAR(64),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS audit_created_idx ON audit_log (created_at DESC);

-- Sessions (connect-pg-simple)
CREATE TABLE IF NOT EXISTS user_sessions (
  sid    VARCHAR NOT NULL PRIMARY KEY,
  sess   JSON NOT NULL,
  expire TIMESTAMP(6) NOT NULL
);
CREATE INDEX IF NOT EXISTS user_sessions_expire_idx ON user_sessions (expire);

CREATE TABLE IF NOT EXISTS schema_migrations (name VARCHAR(255) PRIMARY KEY, applied_at TIMESTAMPTZ NOT NULL DEFAULT now());
