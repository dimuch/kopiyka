/** One expense of the synced ledger that is a grocery of the synced year now, or has a Notion row. */
export interface GroceryState {
  expenseId: number;
  name: string;
  /** Decimal string, '29.10'. */
  amountEur: string;
  /** 'YYYY-MM-DD'. */
  date: string;
  /** Live, in the ledger's live `groceries` category (by tech_name), dated in the synced year. */
  wanted: boolean;
  /** What its Notion row shows, or null when it has none. */
  sent: { pageId: string; name: string; amountEur: string; date: string } | null;
}

export interface GroceryChange {
  kind: 'create' | 'update' | 'trash';
  expense: GroceryState;
}

/** What Notion still needs to hear about, in the given order. */
export function planGroceries(states: GroceryState[]): GroceryChange[] {
  return states.flatMap((s): GroceryChange[] => {
    if (!s.sent) return s.wanted ? [{ kind: 'create', expense: s }] : [];
    if (!s.wanted) return [{ kind: 'trash', expense: s }];
    const changed = s.name !== s.sent.name || s.amountEur !== s.sent.amountEur || s.date !== s.sent.date;
    return changed ? [{ kind: 'update', expense: s }] : [];
  });
}
