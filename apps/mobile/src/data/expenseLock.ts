// Brief 041: an ended month's expenses can't change. Dates are Kyiv 'YYYY-MM-DD'.

/** The earliest date an expense can have today: the 1st of today's month (earlier months have ended). */
export function firstOpenDate(today: string): string {
  return `${today.slice(0, 7)}-01`;
}

/** True when an expense dated `date` is in an ended month, so it shows read-only. */
export function expenseLocked(date: string, today: string): boolean {
  return date < firstOpenDate(today);
}
