import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['lib/base/index.ts', 'lib/react/index.tsx', 'lib/reaction/index.ts'],
  format: ['esm'],
  target: 'es2022',
  platform: 'browser',
  bundle: true,
  minify: true,
  splitting: true,
  clean: true,
  dts: true,
  outDir: 'dist',
});
