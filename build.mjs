// Bundles the browser app (web/main.ts and the CSS it imports) into public/build/.
// `npm run build -- --watch` rebuilds on change.
import { copyFileSync, mkdirSync } from 'node:fs';

import * as esbuild from 'esbuild';

const options = {
  entryPoints: ['web/main.ts'],
  outdir: 'public/build',
  bundle: true,
  format: 'esm',
  target: 'es2022',
  minify: true,
  sourcemap: true,
  tsconfig: 'tsconfig.json',
  // Lets the fallback map load as its own file, only when it's needed
  splitting: true,
  chunkNames: 'chunks/[name]-[hash]',
  // Ionicons are inlined as SVG markup
  loader: { '.svg': 'text' },
  // The ionicons package doesn't export its SVG folder, so point at it directly
  alias: { 'ionicons-svg': './node_modules/ionicons/dist/svg' },
  logLevel: 'info',
};

// MapLibre draws in a Web Worker loaded from its own file, which bundling would leave behind
mkdirSync('public/build', { recursive: true });
copyFileSync('node_modules/maplibre-gl/dist/maplibre-gl-worker.mjs', 'public/build/maplibre-gl-worker.mjs');

if (process.argv.includes('--watch')) {
  const context = await esbuild.context(options);
  await context.watch();
} else {
  await esbuild.build(options);
}
