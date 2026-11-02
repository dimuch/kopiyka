import type { Ledger } from '@/api/types';

/** Where the device keeps a user's chosen ledger id; per user, so two accounts on one phone don't share it. */
export function choiceKey(userId: number): string {
  return `kopiyka.ledger.${userId}`;
}

/** The stored ledger while the user is still in it, else the first (oldest membership), else null for no ledger. */
export function pickLedger(ledgers: Ledger[], stored: string | null): Ledger | null {
  const chosen = stored !== null && /^\d+$/.test(stored) ? Number(stored) : null;
  return ledgers.find((l) => l.ledgerId === chosen) ?? ledgers[0] ?? null;
}
