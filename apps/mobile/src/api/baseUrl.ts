/**
 * The API address for iOS. In development the simulator reaches the Mac on localhost and a real iPhone needs the
 * Mac's LAN address (EXPO_PUBLIC_API_URL, apps/mobile/.env). A release build talks only HTTPS, so a missing or
 * http:// address fails at start instead of sending the session token in clear text.
 */
export function nativeApiUrl(configured: string | undefined, dev: boolean): string {
  if (dev) return configured ?? 'http://localhost:3000';
  if (configured?.startsWith('https://')) return configured;
  throw new Error(`EXPO_PUBLIC_API_URL must be an https:// URL in a release build (got ${configured ?? 'nothing'})`);
}
