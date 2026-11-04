/** What the login screen says for a refused sign-in, by the API's error code; null when there was no answer. */
export function loginErrorText(code: string | null): string {
  if (code === 'invalid_credentials' || code === 'invalid_request') return 'Wrong username or password.';
  if (code === 'blocked') return 'Too many wrong passwords. Sign-in is blocked for 24 hours.';
  // nginx's limit, which clears in a minute, unlike the API's 24-hour `blocked`.
  if (code === 'rate_limited') return 'Too many attempts. Wait a minute and try again.';
  return 'Can’t reach the server. Check your connection and try again.';
}
