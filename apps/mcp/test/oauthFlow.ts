import { createHash } from 'node:crypto';
import type { FastifyInstance } from 'fastify';
import { HOST, LISTED_REDIRECTS, PUBLIC_URL } from './helpers.js';

export const CALLBACK = LISTED_REDIRECTS[0]!;
export const VERIFIER = 'a-verifier-long-enough-to-pass-the-rules-of-pkce';
const CHALLENGE = createHash('sha256').update(VERIFIER).digest('base64url');

export const form = (fields: Record<string, string>) => ({
  headers: { host: HOST, 'content-type': 'application/x-www-form-urlencoded' },
  payload: new URLSearchParams(fields).toString(),
});

/** The value of a hidden field on a page. */
export function hidden(body: string, name: string): string {
  return new RegExp(`name="${name}" value="([^"]+)"`).exec(body)![1]!;
}

export async function registerClient(app: FastifyInstance, clientName = 'Claude'): Promise<string> {
  const res = await app.inject({
    method: 'POST',
    url: '/oauth/register',
    headers: { host: HOST },
    payload: { redirect_uris: [CALLBACK], client_name: clientName },
  });
  return res.json().client_id;
}

/** Opens the sign-in page, and gives back the sealed request it holds. */
export async function startSignIn(app: FastifyInstance, clientId: string, scope?: string): Promise<string> {
  const res = await app.inject({
    url: '/oauth/authorize',
    headers: { host: HOST },
    query: {
      response_type: 'code',
      client_id: clientId,
      redirect_uri: CALLBACK,
      code_challenge: CHALLENGE,
      code_challenge_method: 'S256',
      state: 'xyz',
      resource: `${PUBLIC_URL}/mcp`,
      ...(scope === undefined ? {} : { scope }),
    },
  });
  return hidden(res.body, 'request');
}

/** The URL a "Return to" link or a meta refresh goes to, as a browser would read it. */
export function linkOn(body: string): URL {
  return new URL(/<a href="([^"]+)"/.exec(body)![1]!.replaceAll('&amp;', '&'));
}
