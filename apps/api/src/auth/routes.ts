import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import type { RowDataPacket, ResultSetHeader } from 'mysql2/promise';
import { z } from 'zod';
import type { AppDeps } from '../app.js';
import { ipKey } from './ipKey.js';
import { decryptSecret } from './secretBox.js';
import { createSession, deleteSession, findSession } from './sessions.js';
import { throttledAttempt, throttleKeys } from './throttle.js';
import { generateSecret, verifyTotp } from './totp.js';

export const SESSION_COOKIE = 'kopiyka_session';

const LoginBody = z.object({
  username: z.string().trim().min(1).max(64),
  code: z.string().regex(/^\d{6}$/),
  // Random id the app generates once and keeps (SecureStore / localStorage).
  deviceId: z
    .string()
    .regex(/^[A-Za-z0-9_-]{8,64}$/)
    .optional(),
  // 'web' gets only the httpOnly cookie; 'native' (iPhone) also gets the token to keep in SecureStore.
  client: z.enum(['web', 'native']).default('web'),
});

function bearerOrCookie(req: FastifyRequest): string | null {
  const header = req.headers.authorization;
  if (header?.startsWith('Bearer ')) return header.slice('Bearer '.length).trim() || null;
  return req.cookies[SESSION_COOKIE] ?? null;
}

export async function authRoutes(app: FastifyInstance, deps: AppDeps): Promise<void> {
  const { db, config, now } = deps;

  app.decorate('requireAuth', async (req: FastifyRequest, reply: FastifyReply) => {
    const token = bearerOrCookie(req);
    const session = token ? await findSession(db, token, now()) : null;
    if (!session) return reply.code(401).send({ error: 'unauthorized' });
    req.auth = session;
  });

  app.post('/api/auth/login', async (req, reply) => {
    const body = LoginBody.parse(req.body);
    const at = now();
    const keys = throttleKeys({ username: body.username, ip: ipKey(req.ip), deviceId: body.deviceId ?? '' });

    const attempt = await throttledAttempt(db, keys, at, async (conn) => {
      const [rows] = await conn.query<RowDataPacket[]>(
        'SELECT user_id, username, totp_secret_enc, last_totp_step FROM users WHERE username = ?',
        [body.username],
      );
      const user = rows[0];
      // Unknown usernames still run a check, so both cases take about as long and answer the same.
      const secret = user ? decryptSecret(user.totp_secret_enc, config.totpKey) : generateSecret();
      const step = verifyTotp(secret, body.code, at.getTime(), user ? Number(user.last_totp_step) : 0);
      if (!user || step === null) return null;
      // Guard against the same code racing in twice.
      const [res] = await conn.query<ResultSetHeader>(
        'UPDATE users SET last_totp_step = ? WHERE user_id = ? AND last_totp_step < ?',
        [step, user.user_id, step],
      );
      return res.affectedRows === 1 ? { userId: user.user_id as number, username: user.username as string } : null;
    });
    if (attempt.outcome === 'blocked') return reply.code(429).send({ error: 'blocked' });
    if (attempt.outcome === 'rejected') return reply.code(401).send({ error: 'invalid_credentials' });

    const user = attempt.value;
    const session = await createSession(db, user.userId, at, config.sessionTtlMinutes);
    reply.setCookie(SESSION_COOKIE, session.token, {
      httpOnly: true,
      secure: config.cookieSecure,
      sameSite: 'strict',
      path: '/api',
      expires: session.expiresAt,
    });
    return {
      ...(body.client === 'native' ? { token: session.token } : {}),
      expiresAt: session.expiresAt.toISOString(),
      user,
    };
  });

  app.post('/api/auth/logout', { preHandler: app.requireAuth }, async (req, reply) => {
    await deleteSession(db, req.auth!.tokenHash);
    reply.clearCookie(SESSION_COOKIE, { path: '/api' });
    return reply.code(204).send();
  });
}
