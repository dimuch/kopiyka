-- Brief 054. Invites go to an existing user, chosen by username. Nothing ever wrote the email-keyed table from 001
-- (production's was checked empty before this deployed). Rows are kept: a pending invite becomes accepted, declined
-- or revoked, and one past expires_at has expired without changing. Times come from the app's clock (no DEFAULT),
-- so tests can move past an invite's hour. At most one live pending invite per person per ledger is kept by the
-- create route under the ledger row lock: a unique key can't see expiry.
DROP TABLE ledger_invites;
CREATE TABLE ledger_invites (
  invite_id          INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  ledger_id          INT UNSIGNED NOT NULL,
  invitee_user_id    INT UNSIGNED NOT NULL,          -- the only user who may accept or decline it
  status             ENUM('pending','accepted','declined','revoked') NOT NULL DEFAULT 'pending',
  created_at         DATETIME NOT NULL,              -- sent (UTC)
  expires_at         DATETIME NOT NULL,              -- created_at + 1 hour; a pending invite is live before it
  status_changed_at  DATETIME NULL,                  -- when it stopped being pending; NULL while pending
  INDEX (ledger_id, invitee_user_id, status),
  INDEX (invitee_user_id, status),
  CONSTRAINT fk_invites_ledger  FOREIGN KEY (ledger_id)       REFERENCES ledgers (ledger_id) ON DELETE CASCADE,
  CONSTRAINT fk_invites_invitee FOREIGN KEY (invitee_user_id) REFERENCES users (user_id)     ON DELETE CASCADE
);
