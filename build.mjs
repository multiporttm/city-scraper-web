// Bundles the browser app (web/main.ts and the CSS it imports) into public/build/.
// `npm run build -- --watch` rebuilds on change.
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
  // Ionicons are inlined as SVG markup; Leaflet's CSS points at a few PNGs
  loader: { '.svg': 'text', '.png': 'file' },
  // The ionicons package doesn't export its SVG folder, so point at it directly
  alias: { 'ionicons-svg': './node_modules/ionicons/dist/svg' },
  logLevel: 'info',
};

if (process.argv.includes('--watch')) {
  const context = await esbuild.context(options);
  await context.watch();
} else {
  await esbuild.build(options);
}
