import type { EurUahRate } from '@/api/types';
import { addDays, kyivToday } from '@/format';
import { refuse, type Route } from './state';

/** The demo's EUR→UAH rate for every date: invented, close to the NBU's in late 2026. */
export const SAMPLE_RATE = 50.483;

/** After tomorrow in Kyiv the API has no rate (apps/api/src/rates/service.ts `isAfterRateHorizon`). */
function isAfterRateHorizon(date: string, now: Date): boolean {
  return date > addDays(kyivToday(now), 1);
}

export const expenseRoutes: Route[] = [
  {
    method: 'GET',
    pattern: /^\/api\/rates\/eur-uah$/,
    answer: (_data, { query, now }) => {
      const date = query.get('date') ?? '';
      if (isAfterRateHorizon(date, now)) refuse(400, 'date_in_future');
      const rate: EurUahRate = { date, rateDate: date, eurUah: SAMPLE_RATE };
      return rate;
    },
  },
];
