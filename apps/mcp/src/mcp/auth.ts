import { OAuthError, OAuthErrorCode, type AuthInfo } from '@modelcontextprotocol/server';
import { ApiError, type ApiClient } from '../api.js';
import { open, seal } from '../seal.js';

/**
 * The MCP spec forbids passing the client's token through to another service and requires an audience check, so
 * the client holds this sealed wrapper and only this server ever sees the API token inside it.
 */
export interface AccessToken {
  aud: string;
  apiToken: string;
  clientId: string;
}

interface SealedAccessToken extends AccessToken {
  expMs: number;
}

export function sealAccessToken(key: Buffer, token: AccessToken, expMs: number): string {
  return seal(key, 'access', { ...token, expMs } satisfies SealedAccessToken, expMs);
}

const invalidToken = (reason: string) => new OAuthError(OAuthErrorCode.InvalidToken, reason);

/** Throws `OAuthError` when the client must sign in again, `ApiError` when the API can't say either way. */
export async function verifyAccessToken(
  sealKey: Buffer,
  audience: string,
  api: ApiClient,
  text: string,
  now: Date,
): Promise<AuthInfo> {
  const token = open<SealedAccessToken>(sealKey, 'access', text, now);
  if (!token) throw invalidToken('The access token is invalid or has expired');
  if (token.aud !== audience) throw invalidToken('The access token is for another resource');
  try {
    // Asked on every request, so a token revoked in the API stops working here at once.
    await api.get('/api/api-tokens', token.apiToken);
  } catch (err) {
    if (err instanceof ApiError && err.status === 401) throw invalidToken('The access token has been revoked');
    throw err;
  }
  // No scopes: this server checks none, because the API holds each token's scope and is the only enforcer.
  return { token: token.apiToken, clientId: token.clientId, scopes: [], expiresAt: token.expMs / 1000 };
}
