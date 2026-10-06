import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import type { AppDeps } from '../app.js';
import { addDays, isCalendarDate, kyivToday } from '../dates.js';
import { getEurUahRate, RateUnavailableError } from './service.js';

const RateQuery = z.object({
  date: z
    .string()
    .refine(isCalendarDate, 'expected a YYYY-MM-DD date')
    .refine((d) => d >= '2000-01-01', 'too early'),
});

export async function rateRoutes(app: FastifyInstance, { db, fetchRate, now }: AppDeps): Promise<void> {
  app.get('/api/rates/eur-uah', { preHandler: app.requireAuth }, async (req, reply) => {
    const { date } = RateQuery.parse(req.query);
    // The NBU publishes tomorrow's rate in the afternoon; anything later can't exist yet.
    if (date > addDays(kyivToday(now()), 1)) {
      return reply.code(400).send({ error: 'date_in_future' });
    }
    try {
      return await getEurUahRate(db, fetchRate, date);
    } catch (err) {
      req.log.warn({ err, date }, 'EUR rate unavailable');
      const reason = err instanceof RateUnavailableError ? 'no_rate' : 'nbu_unreachable';
      return reply.code(503).send({ error: 'rate_unavailable', reason });
    }
  });
}
