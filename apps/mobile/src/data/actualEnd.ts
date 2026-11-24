import { api } from '@/api/client';

// A month's actual End, set by hand on the Budget tab (brief 102). Any member can set or clear it, ended months too.

const actualEndPath = (ledgerId: number, month: string) =>
  `/api/ledgers/${ledgerId}/months/${month}/balance/actual-end`;

/** Sets a 'YYYY-MM' month's actual End to `amount`, a signed '-35.00'-style string (`normalizeBalance`). */
export async function setActualEnd(ledgerId: number, month: string, amount: string): Promise<void> {
  await api(actualEndPath(ledgerId, month), { method: 'PUT', body: { amount } });
}

/** Clears a month's actual End, so its End is worked out again. */
export async function clearActualEnd(ledgerId: number, month: string): Promise<void> {
  await api(actualEndPath(ledgerId, month), { method: 'DELETE' });
}
