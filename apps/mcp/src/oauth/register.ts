import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import type { AppDeps } from '../app.js';
import { open, seal } from '../seal.js';

const CLIENT_TTL_MS = 90 * 86_400_000;

const RegisterBody = z.object({
  redirect_uris: z.array(z.string().max(512)).min(1).max(5),
  // Joiners stay: emoji and Persian or Indic names need them. Control characters could break the page's sentence
  // and bidi controls could reverse it, hostname included.
  client_name: z
    .string()
    .trim()
    .max(100)
    .refine((name) => !/[\p{Cc}\p{Bidi_Control}]/u.test(name))
    .default(''),
  token_endpoint_auth_method: z.literal('none').default('none'),
});

export interface Client {
  redirectUris: string[];
  clientName: string;
}

/** Where a URI points, for the log: its query and user details could carry anything. */
function redirectForLog(uri: string): string {
  if (!URL.canParse(uri)) return 'unparseable';
  const url = new URL(uri);
  return url.origin === 'null' ? url.protocol : `${url.origin}${url.pathname}`;
}

/** The client behind a `client_id`, or null if it's forged or has expired. */
export function openClient(sealKey: Buffer, clientId: string, now: Date): Client | null {
  return open<Client>(sealKey, 'client', clientId, now);
}

/** RFC 7591. The `client_id` is the sealed registration, so nothing is stored. */
export async function registerRoutes(app: FastifyInstance, { config, now }: AppDeps): Promise<void> {
  app.post('/oauth/register', async (req, reply) => {
    const body = RegisterBody.safeParse(req.body);
    if (!body.success) {
      return reply.code(400).send({
        error: 'invalid_client_metadata',
        error_description: 'Expected 1 to 5 redirect_uris, a short client_name and no client secret',
      });
    }
    const { redirect_uris: redirectUris, client_name: clientName } = body.data;
    const refused = redirectUris.filter((uri) => !config.allowedRedirectUris.includes(uri));
    if (refused.length) {
      // A real client refused here is the lockout to look for: the fix is MCP_ALLOWED_REDIRECT_URIS.
      req.log.warn({ redirectUris: refused.map(redirectForLog) }, 'client registration refused');
      return reply.code(400).send({
        error: 'invalid_redirect_uri',
        error_description: 'This server only accepts its listed redirect URIs',
      });
    }
    req.log.info({ redirectUris: redirectUris.map(redirectForLog) }, 'client registered');

    const issuedMs = now().getTime();
    const client: Client = { redirectUris, clientName };
    return reply.code(201).send({
      client_id: seal(config.sealKey, 'client', client, issuedMs + CLIENT_TTL_MS),
      client_id_issued_at: Math.floor(issuedMs / 1000),
      client_name: clientName,
      redirect_uris: redirectUris,
      token_endpoint_auth_method: 'none',
      grant_types: ['authorization_code'],
      response_types: ['code'],
    });
  });
}
