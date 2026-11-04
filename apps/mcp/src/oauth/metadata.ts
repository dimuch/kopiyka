import type { FastifyInstance } from 'fastify';
import type { AppDeps } from '../app.js';

/** RFC 8414. No `client_id_metadata_document_supported`, so clients register dynamically. */
export async function metadataRoutes(app: FastifyInstance, { config }: AppDeps): Promise<void> {
  const issuer = config.publicUrl;

  app.get('/.well-known/oauth-authorization-server', async () => ({
    issuer,
    authorization_endpoint: `${issuer}/oauth/authorize`,
    token_endpoint: `${issuer}/oauth/token`,
    registration_endpoint: `${issuer}/oauth/register`,
    response_types_supported: ['code'],
    grant_types_supported: ['authorization_code'],
    code_challenge_methods_supported: ['S256'],
    token_endpoint_auth_methods_supported: ['none'],
    scopes_supported: ['read'],
    authorization_response_iss_parameter_supported: true,
  }));
}
