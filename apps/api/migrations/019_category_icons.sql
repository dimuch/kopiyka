-- Brief 114. A category's icon: one per category, so every member of the ledger sees it, like its tech_name. A key
-- from apps/api/src/categories/icons.ts, never path data or a list index. NULL draws the first letter, as before;
-- nothing is guessed for existing categories.
ALTER TABLE categories
  ADD COLUMN icon VARCHAR(40) NULL; -- 'shopping-cart'; NULL: the letter
