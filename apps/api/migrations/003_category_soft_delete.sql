-- Categories are never hidden any more (brief 012): dropping is_active brings every hidden category back with its
-- expenses. A category is soft-deleted instead, like an expense.
ALTER TABLE categories
  DROP COLUMN is_active,
  ADD COLUMN deleted_at DATETIME NULL; -- soft delete, enables Undo; NULL = live
