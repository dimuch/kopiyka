import type { api as realApi } from '@/api/client';
import { sampleData } from './sampleData';
import { createStore } from './store';

/**
 * The demo build's `@/api/client` (swapped in by metro.config.js): the same `api()`, answered in memory from sample data
 * built at load, so a reload starts over.
 */
export const api: typeof realApi = createStore(sampleData(new Date()), () => new Date());
