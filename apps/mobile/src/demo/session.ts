import type { Ledger } from '@/api/types';
import type { useSession as realUseSession } from '@/auth/AuthContext';
import { DEMO_USER } from './state';

const LEDGER: Ledger = { ledgerId: 1, name: 'Home', role: 'owner', owner: DEMO_USER.username, label: null };

/** No screen in the demo signs out or switches ledgers: there is one demo ledger and no sign-in. */
function unavailable(): never {
  throw new Error('The demo has no sign-in and one ledger');
}

const SESSION: ReturnType<typeof realUseSession> = {
  status: 'signedIn',
  user: DEMO_USER,
  ledger: LEDGER,
  ledgers: [LEDGER],
  logout: unavailable,
  openLedger: unavailable,
};

/** The demo build's `@/auth/AuthContext` (swapped in by metro.config.js): always signed in to the one demo ledger. */
export const useSession: typeof realUseSession = () => SESSION;
