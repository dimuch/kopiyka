export interface Limits {
  toolCallsPerMinute: number;
  toolCallBurst: number;
  openPerToken: number;
  openTotal: number;
  maxOpenMs: number;
  usedCodes: number;
}

export const DEFAULT_LIMITS: Limits = {
  toolCallsPerMinute: 30,
  toolCallBurst: 15,
  openPerToken: 4,
  openTotal: 32,
  maxOpenMs: 600_000,
  usedCodes: 10_000,
};

interface Bucket {
  calls: number;
  updatedMs: number;
}

/** A token bucket per API token, so one connected user or a looping LLM can't flood the API. */
export function toolCallBuckets(limits: Limits, now: () => Date) {
  const buckets = new Map<string, Bucket>();
  const callsPerMs = limits.toolCallsPerMinute / 60_000;

  return {
    /** Takes a call: 0 when allowed, otherwise the whole seconds until one is free. */
    take(tokenKey: string): number {
      const nowMs = now().getTime();
      const bucket = buckets.get(tokenKey) ?? { calls: limits.toolCallBurst, updatedMs: nowMs };
      const calls = Math.min(limits.toolCallBurst, bucket.calls + (nowMs - bucket.updatedMs) * callsPerMs);
      const allowed = calls >= 1;
      buckets.set(tokenKey, { calls: allowed ? calls - 1 : calls, updatedMs: nowMs });
      return allowed ? 0 : Math.ceil((1 - calls) / callsPerMs / 1000);
    },
  };
}

interface OpenRequest {
  close: () => void;
  timer: NodeJS.Timeout;
}

/** Every open `/mcp` request, so neither one token nor everyone together can hold connections without end. */
export function openRequests(limits: Limits) {
  const byToken = new Map<string, OpenRequest[]>();
  let total = 0;

  function forget(tokenKey: string, request: OpenRequest): void {
    const requests = byToken.get(tokenKey);
    if (!requests?.includes(request)) return;
    clearTimeout(request.timer);
    total -= 1;
    if (requests.length === 1) byToken.delete(tokenKey);
    else
      byToken.set(
        tokenKey,
        requests.filter((other) => other !== request),
      );
  }

  function close(tokenKey: string, request: OpenRequest): void {
    forget(tokenKey, request);
    request.close();
  }

  return {
    /** Registers a request and gives back what to call when it ends, or null when the server is full. */
    add(tokenKey: string, closeRequest: () => void): (() => void) | null {
      const requests = byToken.get(tokenKey) ?? [];
      const oldest = requests[0];
      if (oldest && requests.length >= limits.openPerToken) close(tokenKey, oldest);
      if (total >= limits.openTotal) return null;

      const request: OpenRequest = {
        close: closeRequest,
        timer: setTimeout(() => close(tokenKey, request), limits.maxOpenMs).unref(),
      };
      byToken.set(tokenKey, [...(byToken.get(tokenKey) ?? []), request]);
      total += 1;
      return () => forget(tokenKey, request);
    },
  };
}
