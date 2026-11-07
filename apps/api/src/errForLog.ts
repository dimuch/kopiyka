/**
 * The logger's `err` serializer. Only these fields, because the default logs every field on an error, and mysql2 puts
 * a failed query's values in `sql`: an expense's name and amounts would reach the journal. `sqlMessage` goes too, but
 * it only repeats `message`.
 */
export function errForLog(err: Error & { code?: unknown }) {
  return { type: err.constructor.name, code: err.code, message: err.message, stack: err.stack ?? '' };
}
