import { describe, expect, it } from 'vitest';
import { tabBadge } from '@/tabs';

describe('tabBadge', () => {
  it.each([
    ['settings', 'Settings', 0, undefined, 'Settings'],
    ['settings', 'Settings', 1, 1, 'Settings, 1 invite'],
    ['settings', 'Settings', 2, 2, 'Settings, 2 invites'],
    // Only Settings lists invites, so no other tab carries the count.
    ['budget', 'Budget', 3, undefined, 'Budget'],
  ] as const)('%s with %i invites → badge %j, %j', (name, title, count, badge, label) => {
    expect(tabBadge({ name, title }, count)).toEqual({ badge, label });
  });
});
