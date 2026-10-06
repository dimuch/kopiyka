import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

const isWeb = Platform.OS === 'web';

// Web: the session cookie only travels to the same site, so the API is always
// reached on the page's own host: port 3000 in development, the same origin in
// production (nginx serves the app and proxies /api).
// Native: the simulator reaches the Mac on localhost; a real iPhone needs the
// Mac's LAN address in EXPO_PUBLIC_API_URL (apps/mobile/.env).
function apiUrl(): string {
  if (isWeb) {
    return __DEV__ ? `${window.location.protocol}//${window.location.hostname}:3000` : '';
  }
  return process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:3000';
}

export const API_URL = apiUrl();
const TOKEN_KEY = 'kopiyka.session';
const DEVICE_KEY = 'kopiyka.device';

// On web the session is an httpOnly cookie the browser sends itself; on iOS
// it's a bearer token kept in the Keychain via SecureStore.
let token: string | null = null;

export async function loadToken(): Promise<void> {
  if (!isWeb) token = await SecureStore.getItemAsync(TOKEN_KEY);
}

export async function saveToken(value: string | null): Promise<void> {
  token = value;
  if (isWeb) return;
  if (value) await SecureStore.setItemAsync(TOKEN_KEY, value);
  else await SecureStore.deleteItemAsync(TOKEN_KEY);
}

// Not a secret: only labels this install for the API's wrong-code counting.
function randomId(): string {
  let id = '';
  while (id.length < 32) id += Math.random().toString(16).slice(2);
  return id.slice(0, 32);
}

/** A random id kept per install; the API counts wrong login codes per device. */
export async function deviceId(): Promise<string> {
  if (isWeb) {
    try {
      const existing = localStorage.getItem(DEVICE_KEY);
      if (existing) return existing;
      const id = randomId();
      localStorage.setItem(DEVICE_KEY, id);
      return id;
    } catch {
      return randomId();
    }
  }
  const existing = await SecureStore.getItemAsync(DEVICE_KEY);
  if (existing) return existing;
  const id = randomId();
  await SecureStore.setItemAsync(DEVICE_KEY, id);
  return id;
}

export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
  ) {
    super(`${status} ${code}`);
  }
}

let onUnauthorized: () => void = () => {};
/** Called on any 401, e.g. when the 30-minute session ends. */
export function setUnauthorizedHandler(handler: () => void): void {
  onUnauthorized = handler;
}

export async function api<T>(path: string, init: { method?: string; body?: unknown } = {}): Promise<T> {
  const headers: Record<string, string> = {};
  if (init.body !== undefined) headers['content-type'] = 'application/json';
  if (token) headers.authorization = `Bearer ${token}`;

  const res = await fetch(`${API_URL}${path}`, {
    method: init.method ?? 'GET',
    headers,
    body: init.body === undefined ? undefined : JSON.stringify(init.body),
    credentials: 'include',
  });

  if (res.status === 204) return undefined as T;
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    if (res.status === 401 && path !== '/api/auth/login') onUnauthorized();
    throw new ApiError(res.status, (data as { error?: string }).error ?? 'unknown');
  }
  return data as T;
}

export const clientKind = isWeb ? 'web' : 'native';
