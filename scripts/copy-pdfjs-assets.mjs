// Copies the pdf.js worker and its data files from node_modules into public/pdfjs/
// so they are served from this site (same version as the installed library).
// Runs automatically after `npm install` (postinstall) and before dev/build.
import { cpSync, existsSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
let root;
try {
  root = dirname(require.resolve('pdfjs-dist/package.json'));
} catch {
  console.warn('[pdfjs] pdfjs-dist is not installed yet; skipping asset copy.');
  process.exit(0);
}
const out = join(process.cwd(), 'public', 'pdfjs');
mkdirSync(out, { recursive: true });
// Legacy worker: matches the legacy build imported in features/tools/pdf/pdfjs.ts.
cpSync(join(root, 'legacy', 'build', 'pdf.worker.min.mjs'), join(out, 'pdf.worker.min.mjs'));
for (const dir of ['cmaps', 'standard_fonts', 'wasm', 'iccs']) {
  if (existsSync(join(root, dir))) cpSync(join(root, dir), join(out, dir), { recursive: true });
}
console.log(`[pdfjs] assets copied to ${out}`);
