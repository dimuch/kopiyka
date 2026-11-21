import type { MonthBalance } from '@/api/types';
import type { Route } from './state';

/** Every month answers "none": the demo never invents opening and closing balances (brief 090). */
export const balanceRoutes: Route[] = [
  {
    method: 'GET',
    pattern: /^\/api\/ledgers\/\d+\/months\/\d{4}-\d{2}\/balance$/,
    answer: (): { balance: MonthBalance | null } => ({ balance: null }),
  },
];
