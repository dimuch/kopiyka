import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { AccessibilityInfo } from 'react-native';
import { ApiError } from '@/api/apiError';
import { api } from '@/api/client';
import type { Invite } from '@/api/types';
import { useAuth } from '@/auth/AuthContext';

interface InvitesApi {
  /** The signed-in user's live invites; null until loaded for this user. */
  invites: Invite[] | null;
  /** The latest load failed; a failed refetch keeps `invites`. */
  error: boolean;
  /** Clears `failure` and refetches (screens: tab focus, Retry, Check for invites). */
  reload: () => void;
  /** The invite being accepted or declined; every invite's buttons are disabled meanwhile. */
  busyId: number | null;
  /** Why the last Accept or Decline failed. */
  failure: string | null;
  accept: (invite: Invite) => void;
  decline: (invite: Invite) => void;
}

const InvitesContext = createContext<InvitesApi | null>(null);

/**
 * The signed-in user's pending invites, one copy for the whole app: Home, Settings, its tab badge and the no-ledger
 * screen all read it, so an Accept in one place shows everywhere at once.
 */
export function InvitesProvider({ children }: { children: ReactNode }) {
  const { state, openLedger } = useAuth();
  const userId = state.status === 'signedIn' || state.status === 'noLedger' ? state.user.userId : null;
  // Tagged like useMembers' state, so another user (sign-out, then sign-in) reads as loading, never the last list.
  const [version, setVersion] = useState(0);
  const attempt = `${userId}#${version}`;
  const [loaded, setLoaded] = useState<{ userId: number; invites: Invite[] } | null>(null);
  const [failed, setFailed] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [failure, setFailure] = useState<string | null>(null);
  // `busyId` disables the buttons only after a re-render; two taps in one tick would both get here.
  const inFlight = useRef(false);

  // Loads as soon as there's a user (sign-in, or a launch with a stored session), without waiting for a focus event.
  useEffect(() => {
    if (userId === null) return;
    let live = true;
    api<{ invites: Invite[] }>('/api/invites')
      .then((data) => {
        if (!live) return;
        setLoaded({ userId, invites: data.invites });
        setFailed(null);
      })
      .catch(() => live && setFailed(attempt));
    return () => {
      live = false;
    };
  }, [userId, attempt]);

  // Accept and Decline refetch with this, keeping their failure line; `reload` also clears it.
  const refetch = useCallback(() => setVersion((current) => current + 1), []);
  const reload = useCallback(() => {
    setFailure(null);
    refetch();
  }, [refetch]);

  const fail = useCallback((text: string) => {
    // Announced here, once: Home and Settings stay mounted together as tabs, so each announcing would say it twice.
    setFailure(text);
    AccessibilityInfo.announceForAccessibility(text);
  }, []);

  const answer = useCallback(
    async (invite: Invite, send: () => Promise<unknown>, failedText: string, then?: () => Promise<void>) => {
      if (inFlight.current) return;
      inFlight.current = true;
      setBusyId(invite.inviteId);
      setFailure(null);
      try {
        try {
          await send();
        } catch (err) {
          fail(
            err instanceof ApiError && err.code === 'not_found'
              ? `${invite.owner}’s invite has expired or was withdrawn.`
              : failedText,
          );
          return;
        }
        await then?.();
      } finally {
        // Either way the list changed or may have (an expired invite drops out).
        refetch();
        inFlight.current = false;
        setBusyId(null);
      }
    },
    [fail, refetch],
  );

  const accept = useCallback(
    (invite: Invite) =>
      void answer(
        invite,
        () => api(`/api/invites/${invite.inviteId}/accept`, { method: 'POST' }),
        'Couldn’t accept. Check your connection and try again.',
        // Joined: open the ledger. If that fails they're still in, and the next launch finds it.
        () =>
          openLedger(invite.ledgerId).catch(() =>
            fail(
              `Joined ${invite.owner}’s ${invite.ledgerName}, but couldn’t open it yet. Check your connection and ` +
                'reopen the app.',
            ),
          ),
      ),
    [answer, openLedger, fail],
  );

  const decline = useCallback(
    (invite: Invite) =>
      void answer(
        invite,
        () => api(`/api/invites/${invite.inviteId}`, { method: 'DELETE' }),
        'Couldn’t decline. Check your connection and try again.',
      ),
    [answer],
  );

  const value = useMemo(
    () => ({
      invites: userId !== null && loaded?.userId === userId ? loaded.invites : null,
      error: failed === attempt,
      reload,
      busyId,
      failure,
      accept,
      decline,
    }),
    [userId, loaded, failed, attempt, reload, busyId, failure, accept, decline],
  );
  return <InvitesContext.Provider value={value}>{children}</InvitesContext.Provider>;
}

export function useInvites(): InvitesApi {
  const ctx = useContext(InvitesContext);
  if (!ctx) throw new Error('useInvites outside InvitesProvider');
  return ctx;
}
