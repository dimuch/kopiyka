/** Today in Kyiv, as 'YYYY-MM-DD'. A copy on purpose: apps/mcp can't import from the API. */
export function kyivToday(now: Date): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Kyiv' }).format(now);
}
