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

// PDFium powers actual text-object edits, with the binary served by this site.
// Keeping it in public makes the browser path work on Vercel without an API.
try {
  const pdfiumBinary = require.resolve('@embedpdf/pdfium/pdfium.wasm');
  const pdfiumOut = join(process.cwd(), 'public', 'pdfium');
  mkdirSync(pdfiumOut, { recursive: true });
  cpSync(pdfiumBinary, join(pdfiumOut, 'pdfium.wasm'));
  console.log(`[pdfium] asset copied to ${pdfiumOut}`);
} catch {
  console.warn('[pdfium] @embedpdf/pdfium is not installed yet; skipping asset copy.');
}

// OCR worker, engine and English model are also served from this origin.
try {
  const tesseractRoot = dirname(require.resolve('tesseract.js/package.json'));
  const coreRoot = dirname(require.resolve('tesseract.js-core/package.json'));
  const englishRoot = dirname(require.resolve('@tesseract.js-data/eng/package.json'));
  const ocrOut = join(process.cwd(), 'public', 'ocr');
  mkdirSync(ocrOut, { recursive: true });
  cpSync(join(tesseractRoot, 'dist', 'worker.min.js'), join(ocrOut, 'worker.min.js'));
  for (const variant of ['', '-simd', '-lstm', '-simd-lstm']) {
    for (const ext of ['.wasm.js', '.wasm']) {
      const name = `tesseract-core${variant}${ext}`;
      cpSync(join(coreRoot, name), join(ocrOut, name));
    }
  }
  cpSync(join(englishRoot, '4.0.0_best_int', 'eng.traineddata.gz'), join(ocrOut, 'eng.traineddata.gz'));
  console.log(`[ocr] assets copied to ${ocrOut}`);
} catch {
  console.warn('[ocr] Tesseract packages are not installed yet; skipping asset copy.');
}

// Single-thread ffmpeg.wasm core for browser-only video editing.
try {
  const ffmpegRoot = dirname(require.resolve('@ffmpeg/core'));
  const ffmpegWrapperRoot = join(dirname(require.resolve('@ffmpeg/ffmpeg')), '..', 'umd');
  const ffmpegOut = join(process.cwd(), 'public', 'ffmpeg');
  mkdirSync(ffmpegOut, { recursive: true });
  for (const file of ['ffmpeg-core.js', 'ffmpeg-core.wasm']) cpSync(join(ffmpegRoot, file), join(ffmpegOut, file));
  for (const file of ['ffmpeg.js', '814.ffmpeg.js']) cpSync(join(ffmpegWrapperRoot, file), join(ffmpegOut, file));
  console.log(`[ffmpeg] assets copied to ${ffmpegOut}`);
} catch {
  console.warn('[ffmpeg] @ffmpeg/core is not installed yet; skipping asset copy.');
}
