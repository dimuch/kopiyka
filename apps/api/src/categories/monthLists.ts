// Brief 028: each month has its own category list, stored in category_months only when it changes.

/**
 * SQL that is true when category `c` is in the list of the month of a date. That list is the latest stored month
 * on or before the date; a removed row still counts as stored. The outer query must alias categories as `c` (and
 * expenses as `e` for 'e.expense_date'). With '?', the date ('YYYY-MM-DD', any day of the month) is the next param.
 */
export function inMonthList(date: '?' | 'e.expense_date'): string {
  return `EXISTS (SELECT 1 FROM category_months m
                   WHERE m.category_id = c.category_id AND m.deleted_at IS NULL
                     AND m.list_month = (SELECT MAX(lm.list_month) FROM category_months lm
                                           JOIN categories lc ON lc.category_id = lm.category_id
                                          WHERE lc.ledger_id = c.ledger_id AND lm.list_month <= ${date}))`;
}
