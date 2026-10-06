-- Schema from the handoff doc's Data model section.
-- Change: the per-user failed_attempts / locked_until columns moved to
-- login_throttle, which counts failures per username, per IP and per device.
-- All DATETIME values are UTC.

CREATE TABLE users (
  user_id          INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  username         VARCHAR(64)    NOT NULL UNIQUE,
  email            VARCHAR(255)   NOT NULL UNIQUE,
  totp_secret_enc  VARBINARY(255) NOT NULL,          -- AES-256-GCM; key only in server env
  last_totp_step   BIGINT         NOT NULL DEFAULT 0, -- blocks reuse of a code
  created_at       DATETIME       NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE login_throttle (
  key_type         ENUM('username','ip','device') NOT NULL,
  key_value        VARCHAR(64) NOT NULL,             -- lowercased username, IPv4 or IPv6 /64, device id
  failed_attempts  INT         NOT NULL DEFAULT 0,
  last_failed_at   DATETIME    NULL,
  locked_until     DATETIME    NULL,                 -- NULL = not blocked
  PRIMARY KEY (key_type, key_value)
);

CREATE TABLE sessions (
  token_hash  CHAR(64)     PRIMARY KEY,              -- sha256 of the token
  user_id     INT UNSIGNED NOT NULL,
  expires_at  DATETIME     NOT NULL,                 -- absolute: login + 30 min
  created_at  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX (expires_at),
  CONSTRAINT fk_sessions_user FOREIGN KEY (user_id) REFERENCES users (user_id) ON DELETE CASCADE
);

CREATE TABLE ledgers (            -- a shared budget
  ledger_id      INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  name           VARCHAR(100) NOT NULL DEFAULT '',
  owner_user_id  INT UNSIGNED NOT NULL,
  created_at     DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_ledgers_owner FOREIGN KEY (owner_user_id) REFERENCES users (user_id)
);

CREATE TABLE ledger_members (
  ledger_id  INT UNSIGNED NOT NULL,
  user_id    INT UNSIGNED NOT NULL,
  role       ENUM('owner','member') NOT NULL DEFAULT 'member',
  joined_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (ledger_id, user_id),
  INDEX (user_id),
  CONSTRAINT fk_members_ledger FOREIGN KEY (ledger_id) REFERENCES ledgers (ledger_id) ON DELETE CASCADE,
  CONSTRAINT fk_members_user   FOREIGN KEY (user_id)   REFERENCES users (user_id)     ON DELETE CASCADE
);

CREATE TABLE ledger_invites (
  invite_id   INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  ledger_id   INT UNSIGNED NOT NULL,
  email       VARCHAR(255) NOT NULL,
  invited_by  INT UNSIGNED NOT NULL,
  status      ENUM('pending','accepted','declined','revoked') NOT NULL DEFAULT 'pending',
  created_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX (email, status),
  CONSTRAINT fk_invites_ledger  FOREIGN KEY (ledger_id)  REFERENCES ledgers (ledger_id) ON DELETE CASCADE,
  CONSTRAINT fk_invites_inviter FOREIGN KEY (invited_by) REFERENCES users (user_id)
);

CREATE TABLE categories (
  category_id   INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  ledger_id     INT UNSIGNED NOT NULL,
  tech_name     VARCHAR(50)  NOT NULL,                -- 'eating_out'
  display_name  VARCHAR(100) NOT NULL DEFAULT '',     -- 'eating out'
  sort_order    INT          NOT NULL DEFAULT 0,
  is_active     TINYINT(1)   NOT NULL DEFAULT 1,      -- hide instead of delete when used
  created_at    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (ledger_id, tech_name),
  CONSTRAINT fk_categories_ledger FOREIGN KEY (ledger_id) REFERENCES ledgers (ledger_id) ON DELETE CASCADE
);

CREATE TABLE expenses (
  expense_id        BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  category_id       INT UNSIGNED  NOT NULL,
  expense_date      DATE          NOT NULL,
  name              VARCHAR(200)  NOT NULL DEFAULT '',
  amount_eur        DECIMAL(12,2) NOT NULL DEFAULT 0,  -- used for every total
  amount_uah        DECIMAL(14,2) NOT NULL DEFAULT 0,
  eur_uah_rate      DECIMAL(10,4) NOT NULL DEFAULT 0,  -- NBU rate for expense_date
  entered_currency  ENUM('EUR','UAH') NOT NULL DEFAULT 'EUR',
  created_by        INT UNSIGNED  NOT NULL,
  created_at        DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at        DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  deleted_at        DATETIME NULL,                     -- soft delete, enables Undo
  INDEX (category_id, expense_date),
  INDEX (expense_date),
  CONSTRAINT fk_expenses_category FOREIGN KEY (category_id) REFERENCES categories (category_id),
  CONSTRAINT fk_expenses_creator  FOREIGN KEY (created_by)  REFERENCES users (user_id)
);

CREATE TABLE category_budgets (   -- planned amount per category per month
  category_id   INT UNSIGNED  NOT NULL,
  budget_month  DATE          NOT NULL,              -- always day 1: 2026-10-01
  planned_eur   DECIMAL(12,2) NOT NULL DEFAULT 0,
  updated_at    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (category_id, budget_month),
  CONSTRAINT fk_budgets_category FOREIGN KEY (category_id) REFERENCES categories (category_id) ON DELETE CASCADE
);
