-- Brief 092. Each member's own order of a ledger's categories, the same in every month. A save writes a position for
-- every live category of the ledger; one with no row (added since, or never ordered) comes after the placed ones in
-- categories.sort_order, then category_id. The rows go with the membership, like ledger_members.label.
CREATE TABLE IF NOT EXISTS category_orders (
  ledger_id      INT UNSIGNED NOT NULL,
  user_id        INT UNSIGNED NOT NULL,
  category_id    INT UNSIGNED NOT NULL,
  list_position  INT UNSIGNED NOT NULL,   -- 0 = top
  PRIMARY KEY (ledger_id, user_id, category_id),
  CONSTRAINT fk_category_orders_member FOREIGN KEY (ledger_id, user_id)
    REFERENCES ledger_members (ledger_id, user_id) ON DELETE CASCADE,
  CONSTRAINT fk_category_orders_category FOREIGN KEY (category_id)
    REFERENCES categories (category_id) ON DELETE CASCADE
);
