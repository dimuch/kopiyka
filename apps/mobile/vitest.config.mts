import { defineConfig } from 'vitest/config';

export default defineConfig({
  // Resolve `@/…` like Metro does, from the tsconfig paths.
  resolve: { tsconfigPaths: true },
  test: {
    include: ['test/**/*.test.ts'],
  },
});
