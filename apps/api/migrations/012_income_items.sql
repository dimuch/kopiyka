-- Brief 058. A ledger's income for a month: any number of items, from any member, EUR only. From 2026-11 a month's
-- planned total may not exceed its income total (brief 060).
CREATE TABLE IF NOT EXISTS income_items (
  income_id     INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  ledger_id     INT UNSIGNED  NOT NULL,
  income_month  DATE          NOT NULL,              -- always day 1: 2026-11-01
  title         VARCHAR(40)   NOT NULL,              -- 'Salary'; the API trims it, 1–40 characters
  amount_eur    DECIMAL(12,2) NOT NULL,              -- > 0, checked by the API
  created_by    INT UNSIGNED  NOT NULL,              -- the member who added it (or copied it in)
  created_at    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX (ledger_id, income_month),
  CONSTRAINT fk_income_ledger  FOREIGN KEY (ledger_id)  REFERENCES ledgers (ledger_id) ON DELETE CASCADE,
  CONSTRAINT fk_income_creator FOREIGN KEY (created_by) REFERENCES users (user_id)
);
