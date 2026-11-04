export interface RecordedCall {
  method: string;
  path: string;
  headers: Headers;
  body: unknown;
  signal: AbortSignal | undefined;
}

export type Answer = { status?: number; json?: unknown; text?: string } | 'hang' | 'network_failure';

/** A `fetch` stub for the kopiyka API: `answer` decides each response, and every call is recorded. */
export function fakeApi(answer: (call: RecordedCall) => Answer | Promise<Answer>): {
  fetch: typeof fetch;
  calls: RecordedCall[];
} {
  const calls: RecordedCall[] = [];
  const stub: typeof fetch = async (input, init) => {
    const url = new URL(String(input));
    const call: RecordedCall = {
      method: init?.method ?? 'GET',
      path: `${url.pathname}${url.search}`,
      headers: new Headers(init?.headers),
      body: typeof init?.body === 'string' ? JSON.parse(init.body) : undefined,
      signal: init?.signal ?? undefined,
    };
    calls.push(call);
    const result = await answer(call);
    if (result === 'network_failure') throw new TypeError('fetch failed');
    if (result === 'hang') {
      return new Promise((_resolve, reject) => {
        init?.signal?.addEventListener('abort', () => reject(init.signal?.reason));
      });
    }
    return new Response(result.text ?? JSON.stringify(result.json ?? {}), { status: result.status ?? 200 });
  };
  return { fetch: stub, calls };
}

export function bearerOf(call: RecordedCall): string | null {
  return call.headers.get('authorization')?.replace(/^Bearer /, '') ?? null;
}
