import { useEffect, useState } from 'react';
import { api } from '@/api/client';
import type { EurUahRate } from '@/api/types';
import { shortDate } from '@/format';

export type Rate =
  { status: 'loading' } | { status: 'ok'; eurUah: number; rateDate: string } | { status: 'unavailable' };

const LOADING: Rate = { status: 'loading' };

/** The NBU EUR→UAH rate for a Kyiv date; `rateDate` is an earlier day when the API fell back to one. */
export function useRate(date: string): Rate {
  // Tagged with its date, so a newer request reads as loading without resetting state in the effect.
  const [loaded, setLoaded] = useState<{ date: string; rate: Rate } | null>(null);

  useEffect(() => {
    let live = true;
    api<EurUahRate>(`/api/rates/eur-uah?date=${date}`)
      .then(
        (nbuRate) =>
          live && setLoaded({ date, rate: { status: 'ok', eurUah: nbuRate.eurUah, rateDate: nbuRate.rateDate } }),
      )
      .catch(() => live && setLoaded({ date, rate: { status: 'unavailable' } }));
    return () => {
      live = false;
    };
  }, [date]);

  return loaded?.date === date ? loaded.rate : LOADING;
}

/** The line under the amount fields: the NBU rate the amounts use, or why there's none yet. */
export function rateLabel(rate: Rate, date: string): string {
  if (rate.status === 'loading') return 'Fetching the NBU rate…';
  if (rate.status === 'unavailable') {
    return `NBU rate for ${shortDate(date)} isn’t available yet; it’s fetched again when you save`;
  }
  const fallback = rate.rateDate !== date ? ` (the latest before ${shortDate(date)})` : '';
  return `1 € = ₴${rate.eurUah.toFixed(4)} · NBU official rate for ${shortDate(rate.rateDate)}${fallback}`;
}
