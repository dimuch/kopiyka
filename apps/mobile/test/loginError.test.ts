import { describe, expect, it } from 'vitest';
import { loginErrorText } from '@/data/loginError';

describe('loginErrorText', () => {
  it.each([
    ['rate_limited', 'Too many attempts. Wait a minute and try again.'],
    ['blocked', 'Too many wrong passwords. Sign-in is blocked for 24 hours.'],
    ['invalid_credentials', 'Wrong username or password.'],
    ['invalid_request', 'Wrong username or password.'],
    ['internal', 'Can’t reach the server. Check your connection and try again.'],
    [null, 'Can’t reach the server. Check your connection and try again.'],
  ])('says the right thing for %s', (code, text) => {
    expect(loginErrorText(code)).toBe(text);
  });
});
