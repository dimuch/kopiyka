-- Brief 033. A month's category list is exactly its own rows here: nothing carries over any more, and a month with
-- no live row has no budget yet. Each ledger's months from its first month (the earlier of the month it was created
-- and the month of its earliest expense, deleted ones included) up to now keep the list they inherited (brief 028),
-- written out as their own rows; earlier and later months have no budget, except a later month that already has its
-- own rows (a removal made there, brief 029), which keeps them. created_at is in the DB server's zone,
-- never later than Kyiv's month for a server at or west of Kyiv. Kyiv is UTC+2 or +3, so UTC+3 is never a month
-- early. A month that already holds a live expense keeps its list too (on a month's last day an expense can be
-- dated Kyiv tomorrow). Only live rows of live categories are copied: a month's own removed rows keep their Undo
-- stamp, and categories deleted before 028 stay hidden by categories.deleted_at.
START TRANSACTION;

INSERT INTO category_months (category_id, list_month)
WITH RECURSIVE
  bounds (ledger_id, first_month, last_day) AS (
    SELECT l.ledger_id,
           LEAST(DATE(DATE_FORMAT(l.created_at, '%Y-%m-01')),
                 COALESCE((SELECT DATE(DATE_FORMAT(MIN(e.expense_date), '%Y-%m-01'))
                             FROM expenses e JOIN categories ec ON ec.category_id = e.category_id
                            WHERE ec.ledger_id = l.ledger_id), DATE '9999-12-01')),
           GREATEST(DATE(UTC_TIMESTAMP() + INTERVAL 3 HOUR),
                    COALESCE((SELECT MAX(e.expense_date)
                                FROM expenses e JOIN categories ec ON ec.category_id = e.category_id
                               WHERE ec.ledger_id = l.ledger_id AND e.deleted_at IS NULL), DATE '2000-01-01'))
      FROM ledgers l),
  months (list_month) AS (
    SELECT MIN(first_month) FROM bounds
    UNION ALL
    SELECT list_month + INTERVAL 1 MONTH FROM months
     WHERE list_month + INTERVAL 1 MONTH <= (SELECT MAX(last_day) FROM bounds))
SELECT m.category_id, mo.list_month
  FROM months mo
  JOIN bounds b ON mo.list_month BETWEEN b.first_month AND b.last_day
  JOIN categories c ON c.ledger_id = b.ledger_id AND c.deleted_at IS NULL
  JOIN category_months m ON m.category_id = c.category_id AND m.deleted_at IS NULL
 WHERE m.list_month < mo.list_month -- a month with its own rows keeps them
   AND m.list_month = (SELECT MAX(lm.list_month) FROM category_months lm
                         JOIN categories lc ON lc.category_id = lm.category_id
                        WHERE lc.ledger_id = c.ledger_id AND lm.list_month <= mo.list_month);

-- Months before a ledger's first month have no budget: drop their rows (the 2000-01 seed), now that the inherited
-- lists are written out.
DELETE m FROM category_months m
  JOIN categories c ON c.category_id = m.category_id
  JOIN ledgers l ON l.ledger_id = c.ledger_id
 WHERE m.list_month < LEAST(DATE(DATE_FORMAT(l.created_at, '%Y-%m-01')),
                            COALESCE((SELECT DATE(DATE_FORMAT(MIN(e.expense_date), '%Y-%m-01'))
                                        FROM expenses e JOIN categories ec ON ec.category_id = e.category_id
                                       WHERE ec.ledger_id = l.ledger_id), DATE '9999-12-01'));

COMMIT;
