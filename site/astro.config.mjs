import { defineConfig } from 'astro/config';
import { fileURLToPath } from 'node:url';

// The math lives in ../core and is imported through this alias, not a workspace,
// so the core package and its lockfile stay untouched.
const core = fileURLToPath(new URL('../core/src', import.meta.url));

export default defineConfig({
  output: 'static',
  base: process.env.SITE_BASE ?? '/',
  build: { inlineStylesheets: 'always' },
  vite: { resolve: { alias: { '@core': core } } },
});
