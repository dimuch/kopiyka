import { z } from 'zod';
import { MONTH_RE } from './dates.js';

/** A 'YYYY-MM' month in a route's params or query. Its Zod issue is part of the 400 body clients see. */
export const MonthString = z.string().regex(MONTH_RE, 'expected YYYY-MM');
