import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { api, clientKind, deviceId, loadToken, saveToken, setUnauthorizedHandler } from '@/api/client';
import type { Ledger, User } from '@/api/types';

type AuthState =
  | { status: 'loading' }
  | { status: 'signedOut' }
  | { status: 'signedIn'; user: User; ledger: Ledger; ledgers: Ledger[] };

interface AuthApi {
  state: AuthState;
  login: (username: string, code: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthApi | null>(null);

async function fetchMe(): Promise<AuthState> {
  const me = await api<{ user: User; ledgers: Ledger[] }>('/api/ledgers');
  const ledger = me.ledgers[0];
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

  const value = useMemo(() => ({ state, login, logout }), [state, login, logout]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthApi {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth outside AuthProvider');
  return ctx;
}

/** The signed-in session; only for screens behind the sign-in redirect. */
export function useSession() {
  const { state, logout } = useAuth();
  if (state.status !== 'signedIn') throw new Error('useSession while signed out');
  return { ...state, logout };
}
