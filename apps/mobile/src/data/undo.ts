// Hands a just-deleted expense from the edit screen to the screen it returns to,
// which shows the Undo bar. One pending delete at a time.

export interface PendingUndo {
  ledgerId: number;
  expenseId: number;
  label: string;
}

let pending: PendingUndo | null = null;

export function setPendingUndo(undo: PendingUndo): void {
  pending = undo;
}

export function takePendingUndo(): PendingUndo | null {
  const taken = pending;
  pending = null;
  return taken;
}
