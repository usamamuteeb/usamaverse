# UsamaVerse — public browser toolbox

A fast, anonymous toolbox built with **Next.js (App Router) + TypeScript**. No accounts, no database, no AI, no analytics. Every tool shipped today runs **entirely in the browser**.

> “UsamaVerse” is a working placeholder name. Change it in `lib/site.ts`.

## Run it (Windows, macOS or Linux)

Requires Node.js 20.9+.

```bash
npm install
npm run dev          # http://localhost:3000
```

`npm install` and `npm run build` copy local pdf.js, PDFium, English OCR, and FFmpeg WebAssembly assets into `public/` (see `scripts/copy-pdfjs-assets.mjs`). Vercel runs the same build step.

Before you push or deploy:

```bash
npm run check        # typecheck + lint + unit tests + production build
npm run test:e2e     # optional: Playwright browser tests (first run: npx playwright install chromium)
```

## What’s included

- **51 focused workspaces** organize 229 working actions across 17 categories. Each action has a direct `/tools/[slug]` URL. File processing runs in the browser; inputs are not uploaded.
- The de-duplicated original roadmap has no unimplemented entries (`lib/tools/registry.planned.ts`). This count describes the shipped actions, not feature parity with desktop editing suites.
- Routes: `/`, `/tools`, `/workspaces/[slug]`, `/tools/[slug]`, `/category/[slug]`, `/favorites`, `/recent`, `/privacy`, `/help`, `/feedback`, plus `sitemap.xml` and `robots.txt`.
- Instant local search (aliases, synonyms, accents, punctuation), `Ctrl/⌘ + K` outside text fields, arrow keys / Enter / Escape, focus restored.
- `/tools` shows task-focused workspaces by default; searches still find individual actions. Filters live in the URL (`?q=&category=`).
- Favorites, recent tools, the visual-effects switch and the Checklist tool use browser-local storage (versioned `usamaverse:v1:*` keys), clearable from the Privacy page.
- Compact light glass theme with an optional dark mode, restrained motion, and `prefers-reduced-motion` support. The typing app is branded **UsamaType**.

PDF workspaces keep the selected PDF in memory as you switch actions. The editor supports direct page placement, selection, movement, text revision, shape/image resizing, deletion, undo and redo. It edits existing text objects in the PDF content stream with PDFium, preserving other page text and form fields in tested documents. Text size and color can be changed. Some PDFs store text as images or paths, and complex fonts or rotations may still limit editing. After saving, **Continue with this version** makes the edited PDF the input for the next PDF action. White-out overlays only cover content visually; use Redact PDF for sensitive information. See [PDF coverage and gaps](docs/pdf-coverage.md).

### Implemented tools

| Category | Tools |
|---|---|
| Text (14) | Count, transform, compare, clean and generate text. |
| Developer (19) | JSON, YAML, XML, HTML, CSS, JavaScript, SQL, Base64, JWT, regex, Markdown and other developer utilities. |
| Generators & security (12) | Passwords, audited-list passphrases, secure random values, hashes, QR codes and barcodes. |
| Image (17) | Resize, crop, compress, convert, inspect, create placeholders and clean SVGs. |
| Files (5) | Inspect and hash files, join text, create and extract ZIP archives. |
| PDF (35) | Direct page editing, forms, signing, redaction, OCR, page operations, Office conversions, protection and reusable workflows. |
| Math (14) | Calculators for everyday, finance, fractions, statistics, grades and bases. |
| Units (18) | Physical and digital conversions plus an adidas adult shoe-size chart. |
| Dates & time (14) | Date arithmetic, timers, world time, meeting planning and calendars. |
| Color & design (12) | Colors, contrast, palettes, CSS design and vision simulation. |
| Web (13) | URLs, page analysis, SEO and web reference tools. |
| CSV (9) | View, sort, filter and transform tables, plus a formula helper. |
| Audio & video (12) | Inspect, trim, adjust, join, extract, mute and convert media; capture video frames and inspect GIFs. |
| Language (11) | Unicode, emoji, keyboard layouts, Morse, NATO, Braille and number text. |
| Misc (8) | Tables, invoices, printable labels, a screen ruler and QR/barcode image readers. |
| Career (8) | Build CVs, draft cover letters and tailor applications. |
| LaTeX (8) | Convert, format and build LaTeX, tables and BibTeX. |

### PDF tools: how they work

- **Engines:** [pdf-lib](https://pdf-lib.js.org) (MIT) writes and organizes PDFs; [pdf.js](https://mozilla.github.io/pdf.js/) (Apache-2.0) renders previews and reads text; [EmbedPDF PDFium](https://www.embedpdf.com/docs/pdfium/introduction) (MIT wrapper with Apache-2.0 PDFium) edits existing text, handles passwords and extracts image objects; [Tesseract.js](https://github.com/naptha/tesseract.js) (Apache-2.0) runs English OCR.
- **Local only:** files are processed in the browser and never uploaded. Engine assets and the English OCR model are served from this site, not a third-party CDN.
- **Rotated and cropped pages:** stamps, crops, signatures and edits are placed in the page as you see it (see `features/tools/pdf/ops.ts`).
- **Honest limits:** added text uses built-in Latin fonts; editing existing text depends on how its font and glyphs are stored. Crop and white-out only *hide* content, so use Redact to remove it. Redact turns marked pages into images with the boxes burned in, then checks that the searched text is gone. Visual signatures are not certificate signatures. OCR is English-only, depends on scan quality and positions text approximately. Compress tells you when it can’t make a file smaller.
- **Conversion fidelity:** DOCX/PPTX/local HTML → PDF is visually rendered; DOCX and XLSX extraction from PDF is editable but approximate; PDF → PPTX uses page images. PDF/A-2b rasterizes pages and passed a veraPDF sample validation. See [PDF coverage and gaps](docs/pdf-coverage.md).
- **Workflows:** The builder chains page rotation/removal, numbering, text watermarking, metadata and lossless optimization, and stores or exports a settings-only recipe. It processes one selected PDF at a time.

### Capability limits

Video trimming, muting and conversion use a locally served 32 MB FFmpeg WebAssembly engine and accept inputs up to 100 MB with a 10-minute processing limit. Media conversion exports MP4, WebM, GIF, MP3 or WAV. PDF-to-Office reconstruction is editable but approximate, especially for complex layouts. Local AI translation and summarization are not included because this site has no model service.

## Project layout

```text
app/                         routes (server components) + globals.css
components/                  header, search dialog, cards, tools browser, runner
components/tool-kit/         shared tool UI: fields, copy/download, TransformTool, FormTool…
features/tools/<category>/   one file per tool UI + pure logic.ts per category
lib/tools/registry.implemented.ts   metadata for live tools (public)
lib/tools/registry.planned.ts       backlog metadata (never public)
lib/tools/loader-map.ts      explicit lazy import per tool (one chunk each)
lib/tools/public.ts          the only module UI uses to list/search/count tools
lib/tools/search.ts          local search index
lib/tools/shared/            csv, secure random, clipboard, download helpers
workers/regex.worker.ts      off-main-thread regex execution
styles/tokens.css            design tokens (colors, spacing, motion)
tests/                       unit + registry integrity tests (node:test via tsx)
e2e/                         Playwright browser tests
```

## Adding a tool

1. Write pure logic in `features/tools/<category>/logic.ts` and unit-test it in `tests/`.
2. Create `features/tools/<category>/<slug>.tsx` (default export, `'use client'`). Most tools are a few lines using `TransformTool`, `FormTool`, `GeneratorTool`, `StatsTool` or `UnitConverter`.
3. Add metadata to `registry.implemented.ts` or one of its batch modules (description, aliases, tags, related, limits).
4. Add one line to `lib/tools/loader-map.ts`.
5. `npm test` — it fails if slugs duplicate, categories are invalid, related links are broken, or the registry and loader map disagree.

## Dependencies

Runtime dependencies include `next`, `react`, `react-dom`, `pdf-lib`, `pdfjs-dist`, `@embedpdf/pdfium`, `tesseract.js`, `@zxing/browser`, `@scure/bip39`, `@emoji-mart/data` and `@ffmpeg/ffmpeg`/`@ffmpeg/core`. Heavy engines load only when their actions run. The FFmpeg core package is GPL-2.0-or-later; review its license when distributing a modified build. All codec assets are served from this site.

## Privacy & security model

- Tool inputs never go into URLs, logs or third parties. A Content-Security-Policy (`next.config.ts`) sets `connect-src 'self'`, so pages cannot send data elsewhere.
- Security-sensitive randomness uses `crypto.getRandomValues` with rejection sampling; there is **no `Math.random` fallback** (a test enforces this).
- The calculator uses a hand-written parser; nothing is `eval`’d. Markdown escapes all input before generating tags, blocks `javascript:`/`data:` links and never loads remote images. XML/HTML is never executed.
- Image tools check file signatures (not just extensions), verify the encoded Blob’s MIME type, revoke object URLs and close bitmaps.

## Art and brand assets

All visuals are original inline SVG (`components/HeroArt.tsx`, `components/Brand.tsx`, `app/icon.svg`): a crimson moon, mist and generic crows inspired by a dark “crimson anime” mood. No character art, logos or emblems from any franchise are included or hotlinked. To use licensed art, replace `HeroArt` and keep it decorative (`aria-hidden`). There is no affiliation with any anime franchise.

## Deploying to Vercel

1. Push this folder to the connected Git repository. Vercel will rebuild the Next.js project.
2. Optional: set `NEXT_PUBLIC_SITE_URL` (e.g. `https://your-domain`) for canonical URLs and the sitemap.
3. Every page is static or pre-rendered; there are no server functions, secrets, auth or database. The build copies the FFmpeg, PDF, and OCR assets into `public/` for same-origin loading.

Check Vercel’s current plan limits when you deploy; nothing here assumes unlimited usage.
