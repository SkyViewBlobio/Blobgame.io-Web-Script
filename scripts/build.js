import { mkdir } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';

const rootDir = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const outputFile = resolve(rootDir, 'dist/blobio-extension.bundle.js');

await mkdir(dirname(outputFile), { recursive: true });

await build({
  entryPoints: [resolve(rootDir, 'src/main.js')],
  outfile: outputFile,
  bundle: true,
  format: 'iife',
  target: 'es2020',
  loader: {
    '.png': 'dataurl',
  },
  banner: {
    js: '/* Blobio extension bundle. Generated from src/. */',
  },
});
