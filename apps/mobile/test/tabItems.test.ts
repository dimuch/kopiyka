import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Invite } from '@/api/types';
import { useInvites } from '@/data/invites';
import { useTabItems } from '@/data/tabItems';

vi.mock('@/data/invites', () => ({ useInvites: vi.fn() }));

const invite: Invite = { inviteId: 1, ledgerId: 2, ledgerName: 'Home', owner: 'anna' };
const reload = vi.fn();

function withInvites(invites: Invite[] | null) {
  vi.mocked(useInvites).mockReturnValue({ invites, reload } as unknown as ReturnType<typeof useInvites>);
}

describe('useTabItems', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it.each([
    ['not loaded', null, undefined, 'Settings'],
    ['none', [], undefined, 'Settings'],
    ['one', [invite], 1, 'Settings, 1 invite'],
    ['two', [invite, invite], 2, 'Settings, 2 invites'],
  ])('with invites %s, keeps the six tabs and puts the badge on Settings', (_case, invites, badge, label) => {
    withInvites(invites);

    const { tabs } = useTabItems();

    expect(tabs.map((tab) => tab.name)).toEqual(['index', 'income', 'budget', 'expenses', 'statistics', 'settings']);
    expect(tabs.slice(0, 5).map((tab) => tab.badge)).toEqual([undefined, undefined, undefined, undefined, undefined]);
    expect(tabs[0]).toMatchObject({ title: 'Home', icon: 'home', href: '/', label: 'Home' });
    expect(tabs[5]).toMatchObject({ badge, label });
  });

  it('runs the invites reload itself when a tab gains focus', () => {
    withInvites([]);

    expect(useTabItems().onTabFocus).toBe(reload);
  });
});
