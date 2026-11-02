/**
 * The SQL condition for a live invite: still pending, and its hour (brief 054) not up. `table` is the
 * `ledger_invites` alias in the query; the condition takes one parameter, the current time. Only the aliases callers
 * use are allowed, since the name goes into the SQL as is.
 */
export function liveInvite(table: 'i' | 'ledger_invites'): string {
  return `${table}.status = 'pending' AND ${table}.expires_at > ?`;
}
