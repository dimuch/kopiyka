import { describe, expect, it } from 'vitest';
import { liveInvite } from '../src/invites/live.js';

describe('liveInvite', () => {
  it('builds the live-invite condition for the given alias', () => {
    expect(liveInvite('i')).toBe("i.status = 'pending' AND i.expires_at > ?");
    expect(liveInvite('ledger_invites')).toBe("ledger_invites.status = 'pending' AND ledger_invites.expires_at > ?");
  });

  // The check is the typecheck: `yarn typecheck` fails if the directive below stops being needed.
  it('takes only the aliases its callers use, since the name goes into SQL as is', () => {
    // @ts-expect-error -- only the aliases its callers use reach SQL
    liveInvite('users');
  });
});
