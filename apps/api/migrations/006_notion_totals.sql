-- Brief 022. Each add kopiyka makes to a category-month's Actual Amount in the Notion Expenses table. It's recorded
-- before Notion is written, so a run after an interrupted one can tell from the row whether the add landed.
CREATE TABLE notion_total_adds (
  add_id           INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  category_id      INT UNSIGNED  NOT NULL,
  add_month        DATE          NOT NULL,                -- always day 1: 2026-10-01
  notion_page_id   CHAR(32)      NOT NULL,                -- the category-month's Expenses row, 32 lowercase hex
  base_amount      DECIMAL(12,2) NOT NULL,                -- Actual Amount before the add; empty counts as 0
  expected_amount  DECIMAL(12,2) NOT NULL,                -- base + the rounded add: what the row shows once it landed
  confirmed        BOOLEAN       NOT NULL DEFAULT FALSE,  -- Notion has it (write answered, or a later run read it back)
  CONSTRAINT fk_notion_total_adds_category FOREIGN KEY (category_id) REFERENCES categories (category_id)
);

-- Non-grocery expenses that Notion's Actual Amount already includes. A live one of the synced ledger and year
-- without a row here is new; edits and deletes of a counted one are never sent.
CREATE TABLE notion_counted_expenses (
  expense_id  BIGINT UNSIGNED PRIMARY KEY,
  add_id      INT UNSIGNED NULL,   -- the add that counted it; NULL = counted without a write (starting point, or rounded to 0)
  CONSTRAINT fk_notion_counted_expense FOREIGN KEY (expense_id) REFERENCES expenses (expense_id),
  CONSTRAINT fk_notion_counted_add FOREIGN KEY (add_id) REFERENCES notion_total_adds (add_id)
);

-- Set by `notion-start --totals`; the totals sync refuses to run before it. A row can now exist before the first
-- clean sync.
ALTER TABLE notion_syncs
  MODIFY last_synced_at DATETIME NULL,          -- UTC; end of the last run with no failed step, NULL before one
  ADD COLUMN totals_started_at DATETIME NULL;   -- UTC; when the totals starting point was recorded
