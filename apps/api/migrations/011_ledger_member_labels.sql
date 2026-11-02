-- Brief 056. Each person's own name for a ledger they're in, shown only to them in place of "Home" (ledgers.name
-- stays "Home" for everyone). NULL until set; clearing sets NULL again. It goes with the membership row when they
-- leave or are removed. The API trims and allows 1–40 characters (code points, as VARCHAR counts them in utf8mb4).
ALTER TABLE ledger_members
  ADD COLUMN label VARCHAR(40) NULL; -- this member's label for the ledger; NULL: none
