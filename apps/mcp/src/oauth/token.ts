import { createHash } from 'node:crypto';
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import type { AppDeps } from '../app.js';
import { DEFAULT_LIMITS } from '../limits.js';
import { sealAccessToken } from '../mcp/auth.js';
import { open } from '../seal.js';
import { CODE_TTL_MS, hashClientId, type AuthorizationCode } from './signIn.js';

const TokenForm = z.object({
  grant_type: z.string(),
  code: z.string(),
  redirect_uri: z.string(),
  client_id: z.string(),
  code_verifier: z.string().max(128),
  resource: z.string().optional(),
});

/** The only state this server keeps, for a minute at most: without it a code could be used twice. */
function usedCodes(maxSize: number) {
  const expiries = new Map<string, number>();
  return {
    has: (jti: string) => expiries.has(jti),
    /** False when full: refusing is safer than forgetting a code that could still be replayed. */
    add(jti: string, nowMs: number): boolean {
      for (const [id, expMs] of expiries) if (expMs <= nowMs) expiries.delete(id);
      if (expiries.size >= maxSize) return false;
      expiries.set(jti, nowMs + CODE_TTL_MS);
      return true;
    },
  };
}

export async function tokenRoutes(app: FastifyInstance, { config, now, limits }: AppDeps): Promise<void> {
  const resource = `${config.publicUrl}/mcp`;
  const used = usedCodes({ ...DEFAULT_LIMITS, ...limits }.usedCodes);

  app.post('/oauth/token', async (req, reply) => {
    const grantType = (req.body as { grant_type?: unknown } | null)?.grant_type;
    if (grantType !== undefined && grantType !== 'authorization_code') {
      return reply.code(400).send({ error: 'unsupported_grant_type' });
    }
    const form = TokenForm.safeParse(req.body);
    if (!form.success) return reply.code(400).send({ error: 'invalid_request' });

    const at = now();
    const { code: sealed, redirect_uri: redirectUri, client_id: clientId, code_verifier: verifier } = form.data;
    const code = open<AuthorizationCode>(config.sealKey, 'code', sealed, at);
    // The code's id, never its text: one code has several spellings that open to the same bytes.
    const valid =
      code !== null &&
      !used.has(code.jti) &&
      code.redirectUri === redirectUri &&
      code.clientIdHash === hashClientId(clientId) &&
      form.data.resource === resource &&
      code.codeChallenge === createHash('sha256').update(verifier).digest('base64url');
    if (!valid) return reply.code(400).send({ error: 'invalid_grant' });

    if (!used.add(code.jti, at.getTime())) return reply.code(503).send({ error: 'temporarily_unavailable' });
    const accessToken = sealAccessToken(
      config.sealKey,
      { aud: resource, apiToken: code.apiToken, clientId: code.clientIdHash },
      code.apiExpiresMs,
    );
    return reply.header('cache-control', 'no-store').send({
      access_token: accessToken,
      token_type: 'Bearer',
      expires_in: Math.floor((code.apiExpiresMs - at.getTime()) / 1000),
      scope: 'read',
    });
  });
}
