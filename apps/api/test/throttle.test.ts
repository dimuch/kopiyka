import { describe, expect, it } from 'vitest';
import { afterFailure, isLocked, LOCK_MS, throttleKeys, type ThrottleState } from '../src/auth/throttle.js';

const HOUR = 60 * 60 * 1000;
const t0 = new Date('2026-10-06T10:00:00Z');
const at = (ms: number) => new Date(t0.getTime() + ms);

function fail(times: number, start: ThrottleState | undefined, gapMs = 1000): ThrottleState {
  let state = start;
  for (let i = 0; i < times; i++) state = afterFailure(state, at(i * gapMs));
  return state!;
}

describe('afterFailure', () => {
  it('counts up to 4 without locking', () => {
    const state = fail(4, undefined);
    expect(state.failedAttempts).toBe(4);
    expect(isLocked(state, at(5000))).toBe(false);
  });

  it('locks for 24 h on the 5th failure', () => {
    const state = fail(5, undefined);
    const fifth = at(4000);
    expect(state.lockedUntil).toEqual(new Date(fifth.getTime() + LOCK_MS));
    expect(isLocked(state, at(23 * HOUR))).toBe(true);
    expect(isLocked(state, new Date(fifth.getTime() + LOCK_MS))).toBe(false);
  });

  it('starts over once the lock has passed', () => {
    const locked = fail(5, undefined);
    const next = afterFailure(locked, at(25 * HOUR));
    expect(next.failedAttempts).toBe(1);
    expect(isLocked(next, at(25 * HOUR))).toBe(false);
  });

  it('forgets failures older than 24 h', () => {
    const state = fail(4, undefined);
    expect(afterFailure(state, at(24 * HOUR + 4000)).failedAttempts).toBe(1);
    expect(afterFailure(state, at(23 * HOUR)).lockedUntil).not.toBeNull();
  });
});

describe('throttleKeys', () => {
  it('lowercases the username and drops an empty device id', () => {
    expect(throttleKeys({ username: ' Ivanka ', ip: '203.0.113.7', deviceId: '' })).toEqual([
      { type: 'username', value: 'ivanka' },
      { type: 'ip', value: '203.0.113.7' },
    ]);
  });
});
