-- Brief 102. A month's actual End, set by hand on the Budget tab like Notion's Actual Closing. While a month has a
-- row, its line ends at it and the next month starts from it; clearing deletes the row. Kept apart from
-- month_balances, which brief 085's import-balances rewrites, so a re-import never touches a hand-set End.
CREATE TABLE IF NOT EXISTS month_actual_ends (
  ledger_id      INT UNSIGNED  NOT NULL,
  balance_month  DATE          NOT NULL,   -- always day 1: 2026-11-01
  closing_eur    DECIMAL(12,2) NOT NULL,   -- signed: negative = money short
  PRIMARY KEY (ledger_id, balance_month),
  CONSTRAINT fk_month_actual_ends_ledger FOREIGN KEY (ledger_id) REFERENCES ledgers (ledger_id) ON DELETE CASCADE
);
