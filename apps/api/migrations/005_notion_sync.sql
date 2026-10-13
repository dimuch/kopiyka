-- Brief 021. A row kopiyka moved to Notion's trash stays recorded, so a later sync doesn't trash it again and a
-- restore in kopiyka brings the same row back.
ALTER TABLE notion_grocery_rows
  ADD COLUMN in_trash BOOLEAN NOT NULL DEFAULT FALSE; -- the Notion row is in trash because kopiyka trashed it

-- When each ledger's last sync run finished, for the status endpoint.
CREATE TABLE notion_syncs (
  ledger_id       INT UNSIGNED PRIMARY KEY,
  last_synced_at  DATETIME NOT NULL,   -- UTC; end of the last run with no failed step
  CONSTRAINT fk_notion_syncs_ledger FOREIGN KEY (ledger_id) REFERENCES ledgers (ledger_id) ON DELETE CASCADE
);
