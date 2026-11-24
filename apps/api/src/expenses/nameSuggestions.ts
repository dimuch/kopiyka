// Name suggestions for the expense form (brief 108): the names a category's recent expenses used, best first.

interface Suggestion {
  name: string;
  key: string;
  uses: number;
  latestDate: string;
}

/**
 * Ranks expense names for suggestions. `newestFirst` must be sorted newest first: the first row seen for a name sets
 * its spelling and latest date. Names that differ only in case or surrounding spaces count as one; empty names are
 * dropped. Order: most uses, then the latest date, then A–Z ignoring case.
 */
export function rankNames(newestFirst: readonly { name: string; expenseDate: string }[]): string[] {
  const byKey = new Map<string, Suggestion>();
  for (const row of newestFirst) {
    const name = row.name.trim();
    if (!name) continue;
    const key = name.toLowerCase();
    const seen = byKey.get(key);
    if (seen) seen.uses += 1;
    else byKey.set(key, { name, key, uses: 1, latestDate: row.expenseDate });
  }
  return [...byKey.values()]
    .sort(
      (a, b) =>
        b.uses - a.uses ||
        (a.latestDate === b.latestDate ? 0 : a.latestDate > b.latestDate ? -1 : 1) ||
        (a.key === b.key ? 0 : a.key < b.key ? -1 : 1),
    )
    .map((suggestion) => suggestion.name);
}
