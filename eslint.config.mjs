import { defineConfig, globalIgnores } from 'eslint/config';
import nextVitals from 'eslint-config-next/core-web-vitals';
import nextTs from 'eslint-config-next/typescript';
import reactHooks from 'eslint-plugin-react-hooks';

export default defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    // React Compiler-era hook rules: kept visible as warnings. The flagged
    // patterns here (mount flags, syncing state to URL params) are intentional.
    plugins: { 'react-hooks': reactHooks },
    rules: {
      'react-hooks/set-state-in-effect': 'warn',
      'react-hooks/refs': 'warn',
      'react-hooks/purity': 'warn',
      'react-hooks/immutability': 'warn',
    },
  },
  globalIgnores(['.next/**', 'out/**', 'build/**', 'node_modules/**', 'public/pdfjs/**', 'public/pdfium/**', 'public/ocr/**', 'public/ffmpeg/**', '.npm-cache/**', 'test-results/**', 'playwright-report/**', 'next-env.d.ts']),
]);
