import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_LIMITS, openRequests, toolCallBuckets } from '../src/limits.js';

describe('toolCallBuckets', () => {
  const T = Date.parse('2026-10-06T10:00:00Z');
  let clock: number;
  const buckets = () => toolCallBuckets(DEFAULT_LIMITS, () => new Date(clock));

  beforeEach(() => {
    clock = T;
  });

  it('allows the burst at once, then one call per two seconds', () => {
    const calls = buckets();

    const burst = Array.from({ length: 15 }, () => calls.take('token'));
    expect(burst).toEqual(Array(15).fill(0));
    expect(calls.take('token')).toBe(2);

    clock = T + 2000;
    expect(calls.take('token')).toBe(0);
    expect(calls.take('token')).toBe(2);
  });

  it('never saves up more than the burst', () => {
    const calls = buckets();
    calls.take('token');

    clock = T + 3_600_000;

    expect(Array.from({ length: 16 }, () => calls.take('token')).filter((wait) => wait === 0)).toHaveLength(15);
  });

  it('counts each token on its own', () => {
    const calls = buckets();
    for (let call = 0; call < 16; call += 1) calls.take('busy');

    expect(calls.take('quiet')).toBe(0);
  });
});

describe('openRequests', () => {
  const limits = { ...DEFAULT_LIMITS, openPerToken: 2, openTotal: 3, maxOpenMs: 60_000 };

  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('closes a token’s oldest request to make room for its newest', () => {
    const open = openRequests(limits);
    const [first, second, third] = [vi.fn(), vi.fn(), vi.fn()];

    open.add('token', first);
    open.add('token', second);
    expect(first).not.toHaveBeenCalled();

    open.add('token', third);

    expect(first).toHaveBeenCalledOnce();
    expect(second).not.toHaveBeenCalled();
    expect(third).not.toHaveBeenCalled();
  });

  it('leaves other tokens alone', () => {
    const open = openRequests(limits);
    const other = vi.fn();
    open.add('other', other);

    open.add('token', vi.fn());
    open.add('token', vi.fn());
    open.add('token', vi.fn());

    expect(other).not.toHaveBeenCalled();
  });

  it('refuses past the overall cap, until a request ends', () => {
    const open = openRequests(limits);
    const release = open.add('a', vi.fn());
    open.add('b', vi.fn());
    open.add('c', vi.fn());

    expect(open.add('d', vi.fn())).toBeNull();

    release!();
    expect(open.add('d', vi.fn())).not.toBeNull();
  });

  it('frees the slot of a request it closed, without counting it twice', () => {
    const open = openRequests({ ...limits, openPerToken: 1, openTotal: 2 });
    const release = open.add('a', vi.fn());
    open.add('a', vi.fn());

    release!();

    expect(open.add('b', vi.fn())).not.toBeNull();
    expect(open.add('c', vi.fn())).toBeNull();
  });

  it('closes a request that stays open too long', () => {
    const open = openRequests(limits);
    const close = vi.fn();
    open.add('token', close);

    vi.advanceTimersByTime(59_999);
    expect(close).not.toHaveBeenCalled();

    vi.advanceTimersByTime(1);
    expect(close).toHaveBeenCalledOnce();
  });

  it('forgets the timer of a request that ended', () => {
    const open = openRequests(limits);
    const close = vi.fn();
    const release = open.add('token', close);

    release!();
    vi.advanceTimersByTime(60_000);

    expect(close).not.toHaveBeenCalled();
  });
});
