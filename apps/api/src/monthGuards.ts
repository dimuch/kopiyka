import type { FastifyReply } from 'fastify';
import { z } from 'zod';
import { MONTH_RE, monthEnded } from './dates.js';

/** A 'YYYY-MM' month in a route's params or query. Its Zod issue is part of the 400 body clients see. */
export const MonthString = z.string().regex(MONTH_RE, 'expected YYYY-MM');

/**
 * An ended month is read-only (brief 028's decisions). False, after answering 409 `month_ended`, when any of the
 * 'YYYY-MM' months has ended in Kyiv at `at`; true, without replying, when all are open.
 */
export function checkMonthOpen(reply: FastifyReply, at: Date, ...months: string[]): boolean {
  for (const month of months) {
    if (monthEnded(month, at)) {
      reply.code(409).send({ error: 'month_ended' });
      return false;
    }
  }
  return true;
}
