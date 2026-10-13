-- Brief 028. Each month has its own category list. A month with no rows here uses the latest earlier month that
-- has some, so a new month carries over the list before it. Every category starts with one row for 2000-01 (the
-- first month an expense can be dated, see RateDate), so every month keeps today's list until one is changed.
CREATE TABLE category_months (
  category_id  INT UNSIGNED NOT NULL,
  list_month   DATE         NOT NULL,   -- always day 1: 2026-10-01
  deleted_at   DATETIME     NULL,       -- removed from this month (Undo); the month still counts as having its own list
  PRIMARY KEY (category_id, list_month),
  CONSTRAINT fk_category_months_category FOREIGN KEY (category_id) REFERENCES categories (category_id) ON DELETE CASCADE
);

-- Deleted categories (013) too: they stay hidden by categories.deleted_at, and a restore brings them back to every month.
INSERT INTO category_months (category_id, list_month) SELECT category_id, '2000-01-01' FROM categories;
