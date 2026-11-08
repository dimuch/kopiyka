const API_TIMEOUT_MS = 5000;

/** `code` is the API's own `error`, `api_error` when it gave none, or `api_unreachable`. */
export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
  ) {
    super(code);
  }
}

export interface ApiClient {
  /** `signal` ends the call early, when the client's own request has been closed. */
  get<T>(path: string, token: string, signal?: AbortSignal): Promise<T>;
  post<T>(path: string, token: string | null, body: object, options?: { forwardedFor?: string }): Promise<T>;
  put<T>(path: string, token: string, body: object): Promise<T>;
  /** Sends no body, so no `content-type`: Fastify refuses an empty JSON body. */
  delete<T>(path: string, token: string): Promise<T>;
}

function parseJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return undefined;
  }
}

function errorCode(body: unknown): string {
  const code = (body as { error?: unknown } | undefined)?.error;
  return typeof code === 'string' ? code : 'api_error';
}

/** This app's only way to the data: the API keeps every access rule, so nothing here repeats them. */
export function apiClient(baseUrl: string, fetchImpl: typeof fetch, timeoutMs = API_TIMEOUT_MS): ApiClient {
  async function request<T>(path: string, init: RequestInit, signal?: AbortSignal): Promise<T> {
    let status: number;
    let text: string;
    try {
      const timeout = AbortSignal.timeout(timeoutMs);
      const res = await fetchImpl(`${baseUrl}${path}`, {
        ...init,
        signal: signal ? AbortSignal.any([timeout, signal]) : timeout,
      });
      status = res.status;
      text = await res.text();
    } catch {
      throw new ApiError(504, 'api_unreachable');
    }
    if (status === 204) return undefined as T;
    const body = parseJson(text);
    if (status < 200 || status >= 300) throw new ApiError(status, errorCode(body));
    if (body === undefined) throw new ApiError(502, 'api_error');
    return body as T;
  }

  const bearer = (token: string | null) => (token ? { authorization: `Bearer ${token}` } : {});
  const json = (token: string | null) => ({ ...bearer(token), 'content-type': 'application/json' });

  return {
    get: (path, token, signal) => request(path, { method: 'GET', headers: bearer(token) }, signal),
    post: (path, token, body, options) =>
      request(path, {
        method: 'POST',
        headers: {
          ...json(token),
          ...(options?.forwardedFor ? { 'x-forwarded-for': options.forwardedFor } : {}),
        },
        body: JSON.stringify(body),
      }),
    put: (path, token, body) => request(path, { method: 'PUT', headers: json(token), body: JSON.stringify(body) }),
    delete: (path, token) => request(path, { method: 'DELETE', headers: bearer(token) }),
  };
}
