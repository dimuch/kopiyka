-- Groceries that have a row in the Notion Groceries table (brief 020). A live grocery of the synced ledger and year
-- without a row here is new; sent_* hold what the Notion row shows, so a difference is an edit still to send.
CREATE TABLE notion_grocery_rows (
  expense_id       BIGINT UNSIGNED PRIMARY KEY,
  notion_page_id   CHAR(32)      NOT NULL UNIQUE,   -- 32 lowercase hex digits, dashes stripped
  sent_name        VARCHAR(200)  NOT NULL,
  sent_amount_eur  DECIMAL(12,2) NOT NULL,
  sent_date        DATE          NOT NULL,
  CONSTRAINT fk_notion_grocery_expense FOREIGN KEY (expense_id) REFERENCES expenses (expense_id)
);
