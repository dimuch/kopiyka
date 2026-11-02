/**
 * The SQL condition for a live invite: still pending, and its hour (brief 054) not up. `table` is the
 * `ledger_invites` alias in the query; the condition takes one parameter, the current time.
 */
export function liveInvite(table: string): string {
  return `${table}.status = 'pending' AND ${table}.expires_at > ?`;
}
