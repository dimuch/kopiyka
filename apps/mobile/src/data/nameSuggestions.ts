// Name suggestions on the expense form (brief 108). The API ranks the names; the form only filters them as you type.

/** How many suggestions the form shows at most. */
export const SUGGESTION_LIMIT = 20;

/** The ranked names containing the typed text, ignoring case and surrounding spaces, in their order. */
export function matchingNames(names: string[], typed: string): string[] {
  const needle = typed.trim().toLowerCase();
  return names.filter((name) => name.toLowerCase().includes(needle)).slice(0, SUGGESTION_LIMIT);
}
