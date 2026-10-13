import { describe, expect, it } from 'vitest';
import { statusText } from '@/data/notionSync';

describe('statusText', () => {
  it.each([
    [5, '2026-10-10T11:02:00.000Z', '5 new · last synced 10 Oct, 14:02'],
    [1, null, '1 new · not synced yet'],
    [0, null, 'Up to date'],
    [0, '2026-10-10T11:02:00.000Z', 'Up to date'],
  ])('%i unsent, last synced %s → %s', (unsent, lastSyncedAt, expected) => {
    expect(statusText({ unsent, lastSyncedAt })).toBe(expected);
  });
});
