import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import type { AppDeps } from '../app.js';
import { getEurUahRate, isAfterRateHorizon, RateDate, rateUnavailableReason } from './service.js';

const RateQuery = z.object({ date: RateDate });

export async function rateRoutes(app: FastifyInstance, { db, fetchRate, now }: AppDeps): Promise<void> {
  app.get('/api/rates/eur-uah', { preHandler: app.requireAuth }, async (req, reply) => {
    const { date } = RateQuery.parse(req.query);
    if (isAfterRateHorizon(date, now())) {
      return reply.code(400).send({ error: 'date_in_future' });
    }
    try {
      return await getEurUahRate(db, fetchRate, date);
    } catch (err) {
      const reason = rateUnavailableReason(err);
      if (!reason) throw err;
      req.log.warn({ err, date }, 'EUR rate unavailable');
      return reply.code(503).send({ error: 'rate_unavailable', reason });
    }
  });
}
