import type { api } from '@/api/client';
import { expenseRoutes } from './expenseRoutes';
import type { StoreData } from './state';

/**
 * The demo's `api()`: answers the routes the demo's screens reach from `data`, with the API's rules and refusals. An
 * unknown route rejects with a plain Error and logs it, because hooks turn any rejection into a quiet load error.
 */
export function createStore(data: StoreData, now: () => Date): typeof api {
  const routes = [...expenseRoutes];
  return async <T>(path: string, init: { method?: string; body?: unknown } = {}): Promise<T> => {
    const method = init.method ?? 'GET';
    const [pathname = '', search = ''] = path.split('?');
    for (const route of routes) {
      if (route.method !== method) continue;
      const match = route.pattern.exec(pathname);
      if (!match) continue;
      const reply = route.answer(
        data,
        { query: new URLSearchParams(search), body: init.body, now: now() },
        match.slice(1),
      );
      // A copy, as the wire would give: a screen changing a reply mustn't change the store.
      return (reply === undefined ? undefined : JSON.parse(JSON.stringify(reply))) as T;
    }
    const message = `The demo store has no route for ${method} ${pathname}`;
    console.error(message);
    throw new Error(message);
  };
}
