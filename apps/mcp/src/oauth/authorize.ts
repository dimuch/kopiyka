import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import type { AppDeps } from '../app.js';
import { seal } from '../seal.js';
import { errorPage, faultPage, sendPage, signInPage } from './pages.js';
import { openClient } from './register.js';

const SIGN_IN_TTL_MS = 10 * 60_000;
const CODE_CHALLENGE = /^[\w-]{43,128}$/;

// A parameter sent twice arrives as an array, and fails here.
const AuthorizeQuery = z.object({
  response_type: z.string().optional(),
  client_id: z.string().optional(),
  redirect_uri: z.string().optional(),
  code_challenge: z.string().optional(),
  code_challenge_method: z.string().optional(),
  state: z.string().optional(),
  scope: z.string().optional(),
  resource: z.string().optional(),
});
type AuthorizeQuery = z.infer<typeof AuthorizeQuery>;

/** A checked authorization request, carried sealed through sign-in and consent. */
export interface AuthorizationRequest {
  clientId: string;
  clientName: string;
  redirectUri: string;
  codeChallenge: string;
  state?: string;
}

/** `redirectUri` with an authorization response on it, including `iss` as RFC 9207 asks. */
export function authorizationResponse(
  redirectUri: string,
  issuer: string,
  params: Record<string, string>,
  state: string | undefined,
): string {
  const url = new URL(redirectUri);
  for (const [name, value] of Object.entries(params)) url.searchParams.set(name, value);
  if (state !== undefined) url.searchParams.set('state', state);
  url.searchParams.set('iss', issuer);
  return url.href;
}

function requestFault(query: AuthorizeQuery, resource: string): string | null {
  if (query.response_type !== 'code') return 'unsupported_response_type';
  if (query.code_challenge_method !== 'S256' || !CODE_CHALLENGE.test(query.code_challenge ?? '')) {
    return 'invalid_request';
  }
  if (query.scope !== undefined && query.scope !== '' && query.scope !== 'read') return 'invalid_scope';
  if (query.resource !== undefined && query.resource !== resource) return 'invalid_request';
  return null;
}

export async function authorizeRoutes(app: FastifyInstance, { config, now }: AppDeps): Promise<void> {
  const issuer = config.publicUrl;
  const resource = `${issuer}/mcp`;

  app.get('/oauth/authorize', async (req, reply) => {
    const parsed = AuthorizeQuery.safeParse(req.query);
    const query = parsed.success ? parsed.data : {};
    const client = query.client_id ? openClient(config.sealKey, query.client_id, now()) : null;
    const { redirect_uri: redirectUri, client_id: clientId } = query;
    // Until the client and its redirect are proven, there's nowhere safe to send an error: that's how open
    // redirectors are made. The list is checked again here because a client_id outlives a change to it.
    if (
      !client ||
      !clientId ||
      !redirectUri ||
      !client.redirectUris.includes(redirectUri) ||
      !config.allowedRedirectUris.includes(redirectUri)
    ) {
      return sendPage(reply, 400, errorPage('This sign-in link isn’t valid, or the app’s registration has expired.'));
    }

    const fault = requestFault(query, resource);
    if (fault) {
      const returnUrl = authorizationResponse(redirectUri, issuer, { error: fault }, query.state);
      return sendPage(reply, 400, faultPage(new URL(redirectUri).hostname, returnUrl));
    }

    const request: AuthorizationRequest = {
      clientId,
      clientName: client.clientName,
      redirectUri,
      codeChallenge: query.code_challenge!,
      state: query.state,
    };
    return sendPage(
      reply,
      200,
      signInPage({
        clientName: request.clientName,
        redirectHost: new URL(redirectUri).hostname,
        request: seal(config.sealKey, 'signin', request, now().getTime() + SIGN_IN_TTL_MS),
      }),
    );
  });
}
