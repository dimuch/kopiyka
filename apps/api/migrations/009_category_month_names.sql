-- Brief 037. A category's name is per month: a rename in October leaves September's name as it was, and a copy takes
-- the source month's names. Every row starts with its category's current name. '' (what code from before 037 writes,
-- not knowing the column) means "no name of its own": reads fall back to categories.display_name, which also names
-- a category in a month before its first row. tech_name (tile hue, Notion match) never changes. Names in a month are
-- unique ignoring case and accents; the collation is declared so it doesn't depend on the server's default.
ALTER TABLE category_months
  ADD COLUMN display_name VARCHAR(100) COLLATE utf8mb4_0900_ai_ci NOT NULL DEFAULT ''; -- this month's name

UPDATE category_months m JOIN categories c ON c.category_id = m.category_id
   SET m.display_name = c.display_name;
