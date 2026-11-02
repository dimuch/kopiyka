import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { api, clientKind, deviceId, loadToken, saveToken, setUnauthorizedHandler } from '@/api/client';
import type { Ledger, User } from '@/api/types';
import { choiceKey, pickLedger } from './ledgerChoice';

type AuthState =
  | { status: 'loading' }
  | { status: 'signedOut' }
  | { status: 'signedIn'; user: User; ledger: Ledger; ledgers: Ledger[] };

interface AuthApi {
  state: AuthState;
  login: (username: string, code: string) => Promise<void>;
  logout: () => Promise<void>;
  /** Remembers the ledger on this device and opens it (or the fallback if it's gone); rejects if reloading fails. */
  openLedger: (ledgerId: number) => Promise<void>;
}

const AuthContext = createContext<AuthApi | null>(null);

/** The user's ledgers, opening the one chosen on this device while they're still in it, else the first. */
async function fetchMe(): Promise<AuthState> {
  const me = await api<{ user: User; ledgers: Ledger[] }>('/api/ledgers');
  // A failed read (storage unavailable) counts as no choice.
  const stored = await AsyncStorage.getItem(choiceKey(me.user.userId)).catch(() => null);
  const ledger = pickLedger(me.ledgers, stored);
  if (!ledger) throw new Error('This user has no ledger');
  return { status: 'signedIn', user: me.user, ledger, ledgers: me.ledgers };
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({ status: 'loading' });

  useEffect(() => {
    setUnauthorizedHandler(() => {
      void saveToken(null);
      setState({ status: 'signedOut' });
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
      if (state.status !== 'signedIn') return;
      // A failed write only means the choice isn't remembered next launch, as for the theme.
      await AsyncStorage.setItem(choiceKey(state.user.userId), String(ledgerId)).catch(() => {});
      setState(await fetchMe());
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
  if (state.status !== 'signedIn') throw new Error('useSession while signed out');
  return { ...state, logout, openLedger };
}
