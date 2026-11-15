import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';

export default defineConfig({
  resolve: { alias: { '@core': fileURLToPath(new URL('../core/src', import.meta.url)) } },
  test: { globals: true, include: ['src/**/*.test.ts'] },
});
