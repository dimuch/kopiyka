import { useEffect, useState } from 'react';
import { api } from '@/api/client';
import type { EurUahRate } from '@/api/types';

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
      .then((r) => live && setLoaded({ date, rate: { status: 'ok', eurUah: r.eurUah, rateDate: r.rateDate } }))
      .catch(() => live && setLoaded({ date, rate: { status: 'unavailable' } }));
    return () => {
      live = false;
    };
  }, [date]);

  return loaded?.date === date ? loaded.rate : LOADING;
}
