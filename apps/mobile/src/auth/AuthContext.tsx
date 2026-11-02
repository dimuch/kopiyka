import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import {
  api,
  clientKind,
  deviceId,
  loadToken,
  saveToken,
  setLedgerGoneHandler,
  setUnauthorizedHandler,
} from '@/api/client';
import type { Ledger, User } from '@/api/types';
import { choiceKey, pickLedger } from './ledgerChoice';

type AuthState =
  | { status: 'loading' }
  | { status: 'signedOut' }
  // Signed in but in no ledger (removed or left, or created with --join and then removed).
  | { status: 'noLedger'; user: User }
  | { status: 'signedIn'; user: User; ledger: Ledger; ledgers: Ledger[] };

interface AuthApi {
  state: AuthState;
  login: (username: string, code: string) => Promise<void>;
  logout: () => Promise<void>;
  /**
   * Remembers the ledger on this device and opens it (or the fallback if it's gone); rejects if reloading fails. Also
   * from no-ledger, after accepting an invite, and on the open ledger after a label change, to reload the ledgers.
   */
  openLedger: (ledgerId: number) => Promise<void>;
}

const AuthContext = createContext<AuthApi | null>(null);

/**
 * The user's ledgers, opening `choice` (or the one chosen on this device) while they're still in it, else the first;
 * none → noLedger.
 */
async function fetchMe(choice?: number): Promise<AuthState> {
  const me = await api<{ user: User; ledgers: Ledger[] }>('/api/ledgers');
  // A failed read (storage unavailable) counts as no choice.
  const stored =
    choice !== undefined ? String(choice) : await AsyncStorage.getItem(choiceKey(me.user.userId)).catch(() => null);
  const ledger = pickLedger(me.ledgers, stored);
  if (!ledger) return { status: 'noLedger', user: me.user };
  return { status: 'signedIn', user: me.user, ledger, ledgers: me.ledgers };
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({ status: 'loading' });

  useEffect(() => {
    setUnauthorizedHandler(() => {
      void saveToken(null);
      setState({ status: 'signedOut' });
    });
    // Reload the ledgers: the app opens the stored choice if it's still there, else another ledger or no-ledger.
    // A failed reload is ignored; the next request tries again. No 'loading' in between, so screens stay mounted.
    setLedgerGoneHandler(() => {
      fetchMe().then(setState, () => {});
    });
    (async () => {
      await loadToken();
      try {
        setState(await fetchMe());
      } catch {
        setState({ status: 'signedOut' });
      }
    })();
  }, []);

  const login = useCallback(async (username: string, code: string) => {
    const res = await api<{ token?: string }>('/api/auth/login', {
      method: 'POST',
      body: { username, code, deviceId: await deviceId(), client: clientKind },
    });
    await saveToken(res.token ?? null);
    setState(await fetchMe());
  }, []);

  const logout = useCallback(async () => {
    try {
      await api('/api/auth/logout', { method: 'POST' });
    } finally {
      await saveToken(null);
      setState({ status: 'signedOut' });
    }
  }, []);

  const openLedger = useCallback(
    async (ledgerId: number) => {
      if (state.status !== 'signedIn' && state.status !== 'noLedger') return;
      const next = await fetchMe(ledgerId);
      // Remembered only once it opened, so a failed switch doesn't come back on the next launch. A failed write only
      // means the choice isn't remembered, as for the theme.
      if (next.status === 'signedIn' && next.ledger.ledgerId === ledgerId) {
        await AsyncStorage.setItem(choiceKey(next.user.userId), String(ledgerId)).catch(() => {});
      }
      setState(next);
    },
    [state],
  );

  const value = useMemo(() => ({ state, login, logout, openLedger }), [state, login, logout, openLedger]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthApi {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth outside AuthProvider');
  return ctx;
}

/** The signed-in session; only for screens behind the sign-in redirect. */
export function useSession() {
  const { state, logout, openLedger } = useAuth();
  if (state.status !== 'signedIn') throw new Error('useSession without an open ledger');
  return { ...state, logout, openLedger };
}
