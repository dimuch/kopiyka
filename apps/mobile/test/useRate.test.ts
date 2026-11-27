import { describe, expect, it, vi } from 'vitest';
import { rateLabel, type Rate } from '@/data/useRate';

vi.mock('@/api/client', () => ({ api: vi.fn() }));

describe('rateLabel', () => {
  it.each<[Rate, string, string]>([
    [{ status: 'loading' }, '2026-11-14', 'Fetching the NBU rate…'],
    [
      { status: 'unavailable' },
      '2026-11-14',
      'NBU rate for 14 Nov 2026 isn’t available yet; it’s fetched again when you save',
    ],
    [
      { status: 'ok', eurUah: 48.5, rateDate: '2026-11-14' },
      '2026-11-14',
      '1 € = ₴48.5000 · NBU official rate for 14 Nov 2026',
    ],
    [
      { status: 'ok', eurUah: 48.5, rateDate: '2026-11-13' },
      '2026-11-15',
      '1 € = ₴48.5000 · NBU official rate for 13 Nov 2026 (the latest before 15 Nov 2026)',
    ],
    [
      { status: 'ok', eurUah: 45.0731, rateDate: '2026-12-31' },
      '2027-01-01',
      '1 € = ₴45.0731 · NBU official rate for 31 Dec 2026 (the latest before 1 Jan 2027)',
    ],
  ])('%o on %s reads %s', (rate, date, text) => {
    expect(rateLabel(rate, date)).toBe(text);
  });
});
