export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    /** The parsed error body, for refusals that carry more than a code (over_income's overEur, brief 060). */
    readonly body: Record<string, unknown> = {},
  ) {
    super(`${status} ${code}`);
  }
}
