-- Brief 085. Each month's opening and closing balance, imported from Notion's Opening and Actual Closing tables
-- (January–October 2026). A side Notion has no row for is filled by the import (previous closing, next opening, or
-- 0). Nothing in the app reads it yet.
CREATE TABLE IF NOT EXISTS month_balances (
  ledger_id      INT UNSIGNED  NOT NULL,
  balance_month  DATE          NOT NULL,   -- always day 1: 2026-01-01
  opening_eur    DECIMAL(12,2) NOT NULL,   -- signed: negative = money carried over
  closing_eur    DECIMAL(12,2) NOT NULL,   -- signed
  PRIMARY KEY (ledger_id, balance_month),
  CONSTRAINT fk_month_balances_ledger FOREIGN KEY (ledger_id) REFERENCES ledgers (ledger_id) ON DELETE CASCADE
);
