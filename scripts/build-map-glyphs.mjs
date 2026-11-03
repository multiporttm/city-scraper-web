// Turns static .ttf fonts into the glyph files MapLibre draws map labels with:
// public/fonts/<FontName>/<start>-<end>.pbf, one file per block of 256 characters.
// The output is committed, so this only needs to run again when the map font changes.
//
// 1. Make static weights from the variable font (needs Python's fonttools: pip install fonttools):
//      fonttools varLib.instancer "assets/fonts/LandUIPro[opsz,wght].ttf" wght=400 opsz=14 -o LandUIPro-Regular.ttf
//      fonttools varLib.instancer "assets/fonts/LandUIPro[opsz,wght].ttf" wght=600 opsz=14 -o LandUIPro-Semibold.ttf
// 2. Install the converter without adding it to package.json (it's a native module):
//      npm install --no-save fontnik
// 3. node scripts/build-map-glyphs.mjs LandUIPro-Regular.ttf LandUIPro-Semibold.ttf
//
// Each font's folder is named after its file (LandUIPro-Regular), which is the name mapStyle.ts uses.
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { basename, join } from 'node:path';

const require = createRequire(import.meta.url);
const fontnik = require('fontnik');

const OUT_DIR = 'public/fonts';
const RANGE_SIZE = 256;
const MAX_CODE_POINT = 65535;

const range = (font, start, end) =>
  new Promise((resolve, reject) => fontnik.range({ font, start, end }, (error, pbf) => (error ? reject(error) : resolve(pbf))));

const files = process.argv.slice(2);
if (files.length === 0) {
  console.error('Usage: node scripts/build-map-glyphs.mjs Font-Regular.ttf [Font-Bold.ttf ...]');
  process.exit(1);
}

for (const file of files) {
  const name = basename(file).replace(/\.[ot]tf$/i, '');
  const font = readFileSync(file);
  const dir = join(OUT_DIR, name);
  mkdirSync(dir, { recursive: true });
  // Every block is written, even empty ones, so MapLibre never gets a 404 for a block the font doesn't cover
  for (let start = 0; start <= MAX_CODE_POINT; start += RANGE_SIZE) {
    const end = start + RANGE_SIZE - 1;
    writeFileSync(join(dir, `${start}-${end}.pbf`), await range(font, start, end));
  }
  console.log(`${name}: wrote ${(MAX_CODE_POINT + 1) / RANGE_SIZE} glyph files to ${dir}`);
}
