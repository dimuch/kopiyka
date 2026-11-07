import { createHash, randomUUID } from 'node:crypto';
import type { FastifyInstance, FastifyReply } from 'fastify';
import { z } from 'zod';
import { ApiError, apiClient } from '../api.js';
import type { AppDeps } from '../app.js';
import { open, seal } from '../seal.js';
import { authorizationResponse, type AuthorizationRequest } from './authorize.js';
import type { Scope } from './metadata.js';
import {
  consentPage,
  declinedPage,
  errorPage,
  returningPage,
  sendPage,
  signInPage,
  type ConsentView,
} from './pages.js';

const CONSENT_TTL_MS = 10 * 60_000;
export const CODE_TTL_MS = 60_000;

const SignInForm = z.object({
  request: z.string(),
  username: z.string().max(64).default(''),
  code: z.string().max(16).default(''),
});
const ConsentForm = z.object({ consent: z.string(), decision: z.enum(['allow', 'deny']) });

interface Consent {
  session: string;
  request: AuthorizationRequest;
}

/** A one-time code: what `POST /oauth/token` checks, and the API token it gives out. */
export interface AuthorizationCode {
  jti: string;
  apiToken: string;
  apiExpiresMs: number;
  clientIdHash: string;
  redirectUri: string;
  codeChallenge: string;
  scope: Scope;
}

export const hashClientId = (clientId: string) => createHash('sha256').update(clientId).digest('hex');

export async function signInRoutes(app: FastifyInstance, { config, now, fetch }: AppDeps): Promise<void> {
  const api = apiClient(config.apiUrl, fetch);
  const issuer = config.publicUrl;
  const hostOf = (request: AuthorizationRequest) => new URL(request.redirectUri).hostname;

  const startAgain = (reply: FastifyReply) =>
    sendPage(reply, 400, errorPage('This sign-in has expired, so you’ll need to start again.'));
  const apiFailed = (reply: FastifyReply, { status, code }: ApiError) => {
    reply.log.warn({ status, code }, 'sign-in stopped by the API');
    return sendPage(reply, 502, errorPage('Kopiyka couldn’t finish signing you in. Try again in a minute.'));
  };
  /** The user is leaving either way: a session left behind ends by itself in 30 minutes. */
  const endSession = (session: string) =>
    api.post('/api/auth/logout', session, {}).catch((err: unknown) => {
      if (!(err instanceof ApiError)) throw err;
    });

  app.post('/oauth/authorize', async (req, reply) => {
    const form = SignInForm.safeParse(req.body);
    const request = form.success
      ? open<AuthorizationRequest>(config.sealKey, 'signin', form.data.request, now())
      : null;
    if (!form.success || !request) return startAgain(reply);
    const { username, code } = form.data;

    let session: string;
    try {
      // The address goes along so that the API's throttle counts this visitor, not this server.
      const login = await api.post<{ token: string }>(
        '/api/auth/login',
        null,
        { username, code, client: 'native' },
        { forwardedFor: req.ip },
      );
      session = login.token;
    } catch (err) {
      if (!(err instanceof ApiError)) throw err;
      if (err.status === 429) return sendPage(reply, 429, errorPage('Too many attempts; try again in 24 hours.'));
      if (err.status !== 400 && err.status !== 401) return apiFailed(reply, err);
      const view = {
        clientName: request.clientName,
        redirectHost: hostOf(request),
        scope: request.scope,
        request: form.data.request,
        username,
        error: 'Wrong username or code',
      };
      return sendPage(reply, 401, signInPage(view));
    }

    let ledgers: ConsentView['ledgers'];
    try {
      ({ ledgers } = await api.get<Pick<ConsentView, 'ledgers'>>('/api/ledgers', session));
    } catch (err) {
      if (!(err instanceof ApiError)) throw err;
      await endSession(session);
      return apiFailed(reply, err);
    }
    const consent: Consent = { session, request };
    return sendPage(
      reply,
      200,
      consentPage({
        clientName: request.clientName,
        redirectHost: hostOf(request),
        scope: request.scope,
        ledgers,
        consent: seal(config.sealKey, 'consent', consent, now().getTime() + CONSENT_TTL_MS),
      }),
    );
  });

  app.post('/oauth/consent', async (req, reply) => {
    const form = ConsentForm.safeParse(req.body);
    const consent = form.success ? open<Consent>(config.sealKey, 'consent', form.data.consent, now()) : null;
    if (!form.success || !consent) return startAgain(reply);
    const { session, request } = consent;

    if (form.data.decision === 'deny') {
      await endSession(session);
      const returnUrl = authorizationResponse(request.redirectUri, issuer, { error: 'access_denied' }, request.state);
      return sendPage(reply, 200, declinedPage(hostOf(request), returnUrl));
    }

    let issued: { token: string; scope: Scope; expiresAt: string };
    try {
      issued = await api.post('/api/api-tokens', session, { label: request.clientName, scope: request.scope });
    } catch (err) {
      if (!(err instanceof ApiError)) throw err;
      // A 401 is a second Allow: the first one used the session up.
      return err.status === 401 ? startAgain(reply) : apiFailed(reply, err);
    }

    const code: AuthorizationCode = {
      jti: randomUUID(),
      apiToken: issued.token,
      apiExpiresMs: Date.parse(issued.expiresAt),
      clientIdHash: hashClientId(request.clientId),
      redirectUri: request.redirectUri,
      codeChallenge: request.codeChallenge,
      scope: issued.scope,
    };
    const sealedCode = seal(config.sealKey, 'code', code, now().getTime() + CODE_TTL_MS);
    const returnUrl = authorizationResponse(request.redirectUri, issuer, { code: sealedCode }, request.state);
    return sendPage(reply, 200, returningPage(hostOf(request), returnUrl));
  });
}
