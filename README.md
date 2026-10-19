# UsamaVerse — public browser toolbox

A fast, anonymous toolbox built with **Next.js (App Router) + TypeScript**. No accounts, no database, no AI, no analytics. Every tool shipped today runs **entirely in the browser**.

> “UsamaVerse” is a working placeholder name. Change it in `lib/site.ts`.

## Run it (Windows, macOS or Linux)

Requires Node.js 20.9+.

```bash
npm install
npm run dev          # http://localhost:3000
```

`npm install` also copies the pdf.js worker and its data files into `public/pdfjs/` (see `scripts/copy-pdfjs-assets.mjs`). If PDF previews ever fail after updating packages, run `npm install` again.

Before you push or deploy:

```bash
npm run check        # typecheck + lint + unit tests + production build
npm run test:e2e     # optional: Playwright browser tests (first run: npx playwright install chromium)
```

## What’s included

- **172 working tools** across 15 categories. All of them run in the browser; nothing you enter or open is uploaded.
- **40 tools still in the backlog** (`lib/tools/registry.planned.ts`) — heavy media editing, Office/PDF conversions that need a server engine, PDF passwords, OCR and a few smaller items. They are never listed, searched, counted or routed (`/tools/<planned-slug>` is a 404).
- Routes: `/`, `/tools`, `/tools/[slug]`, `/category/[slug]`, `/favorites`, `/recent`, `/privacy`, `/help`, `/feedback`, plus `sitemap.xml` and `robots.txt`.
- Instant local search (aliases, synonyms, accents, punctuation), `Ctrl/⌘ + K` outside text fields, arrow keys / Enter / Escape, focus restored.
- `/tools` filters live in the URL (`?q=&category=`), with “Show more” pagination and a mobile category drawer.
- Favorites, recent tools, the visual-effects switch and the Checklist tool use browser-local storage (versioned `usamaverse:v1:*` keys), clearable from the Privacy page.
- Dark obsidian / crimson theme, restrained motion, `prefers-reduced-motion` respected.

### Implemented tools

| Category | Tools |
|---|---|
| Text (14) | word & character counter, line counter, case converter, whitespace cleaner, duplicate line remover, line sorter, text diff, find & replace, slug generator, reading time, lorem ipsum, text reverser, remove blank lines, text to columns |
| Developer (17) | JSON formatter, JSON ↔ CSV, XML formatter, HTML formatter, CSS formatter/minifier, SQL formatter, HTML entities, URL encode/decode, Base64 text, Base64 file, JWT decoder, regex tester, Markdown preview, Unix timestamp, UUID, cron explainer, diff/patch viewer |
| Generators & security (11) | password, random number, random string, PIN, SHA hash, HMAC, CRC-32, bcrypt cost explainer, password strength checker, QR code, barcode (Code 128 / EAN-13 / UPC-A) |
| Image (15) | resize, compress, crop, rotate/flip, PNG → JPEG, JPEG → PNG, to WebP, from WebP, fix EXIF orientation, metadata viewer, favicon generator, image ↔ Base64, color picker from image, social media sizes |
| Files (4) | file type inspector, text file merger, file hash, ZIP creator |
| PDF (22) | merge, split (ranges / every N / each page), organize (thumbnails: reorder, rotate, delete), remove pages, extract pages, rotate, reorder, page numbers, watermark (text or image), crop, compress (lossless or strong), repair, PDF → JPG/PNG, PDF → text/Markdown, images → PDF, scan → PDF (phone camera), fill forms, sign (visual), redact (flattened, verified), edit (text, highlight, boxes, white-out, pen, images), compare (visual or text), metadata |
| Math (14) | calculator, scientific calculator, fractions, percentage, average, median/mode/statistics, tip, discount, sales tax, loan, simple/compound interest, GPA, number bases, random picker |
| Units (17) | length, mass, temperature, area, volume, speed, time, data size, pressure, energy, power, force, angle, frequency, fuel economy, typography, cooking measures |
| Dates & time (14) | date difference, add/subtract, age, stopwatch, countdown timer, countdown to date, time zone converter (DST-aware), world clock, meeting planner, ISO 8601 formatter, week number, business days, weekday finder, duration calculator |
| Color & design (11) | color converter, color picker (eyedropper), contrast checker, palette generator, CSS gradient, box shadow, border radius, type scale, clamp() calculator, aspect ratio, PPI |
| Web (12) | URL parser, query string builder, UTM builder, URL cleaner, URL extractor, meta/Open Graph tags, robots.txt, sitemap.xml, user-agent parser, HTTP status codes, MIME lookup, data URI encoder/decoder |
| CSV (8) | viewer, CSV → Markdown, delimiter detector, column selector, duplicate finder, sorter, filter, TSV ↔ CSV |
| Audio & video (1) | file size / bitrate estimator |
| Language (9) | character frequency, Roman numerals, Unicode inspector, Morse code (with audio), NATO alphabet, number to words, text ↔ binary/hex, Braille (Grade 1), checklist |
| Misc (3) | Markdown table generator, HTML table generator, invoice number generator |

### PDF tools: how they work

- **Engines:** [pdf-lib](https://pdf-lib.js.org) (MIT) writes PDFs; [pdf.js](https://mozilla.github.io/pdf.js/) (Apache-2.0, legacy build for wider browser support) renders previews and reads text. Both load only on PDF tool pages.
- **Local only:** files are processed in the browser and never uploaded. The pdf.js worker is served from this site (`/pdfjs/`), not a CDN.
- **Rotated and cropped pages:** stamps, crops, signatures and edits are placed in the page as you see it (see `features/tools/pdf/ops.ts`).
- **Honest limits:** built-in PDF fonts support Latin text only; password-protected PDFs are refused; crop and white-out only *hide* content, so use Redact to remove it. Redact turns marked pages into images with the boxes burned in, then checks that the searched text is gone. Visual signatures are not certificate signatures. Compress tells you when it can’t make a file smaller.
- **Not built (needs a server engine or a product decision):** Word/PowerPoint/Excel/HTML ↔ PDF, PDF/A, protect/unlock with passwords, OCR, and a workflow builder. AI summarise/translate tools are excluded by design.

### Still deferred (and why)

Video/audio editing (trim, convert, join…) needs a large WebAssembly media library; QR/barcode **readers**, PDF rendering/text extraction/compression and ZIP extraction need heavier parsers with security review; YAML validation, JavaScript formatting, emoji search, passphrases (needs a vetted word list), shoe sizes, color-blindness simulation, keyboard layouts, invoice templates, labels and a screen ruler are smaller items still to do.

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
3. Move the entry from `registry.planned.ts` to `registry.implemented.ts` (description, aliases, tags, related, limits).
4. Add one line to `lib/tools/loader-map.ts`.
5. `npm test` — it fails if slugs duplicate, categories are invalid, related links are broken, or the registry and loader map disagree.

## Dependencies

Only `next`, `react`, `react-dom` and **`pdf-lib`** (MIT, used only on PDF tool pages and loaded on demand). QR codes, barcodes, ZIP, CRC/HMAC, EXIF, CSV, Markdown, formatters and time-zone handling are implemented in this repo.

## Privacy & security model

- Tool inputs never go into URLs, logs or third parties. A Content-Security-Policy (`next.config.ts`) sets `connect-src 'self'`, so pages cannot send data elsewhere.
- Security-sensitive randomness uses `crypto.getRandomValues` with rejection sampling; there is **no `Math.random` fallback** (a test enforces this).
- The calculator uses a hand-written parser; nothing is `eval`’d. Markdown escapes all input before generating tags, blocks `javascript:`/`data:` links and never loads remote images. XML/HTML is never executed.
- Image tools check file signatures (not just extensions), verify the encoded Blob’s MIME type, revoke object URLs and close bitmaps.

## Art and brand assets

All visuals are original inline SVG (`components/HeroArt.tsx`, `components/Brand.tsx`, `app/icon.svg`): a crimson moon, mist and generic crows inspired by a dark “crimson anime” mood. No character art, logos or emblems from any franchise are included or hotlinked. To use licensed art, replace `HeroArt` and keep it decorative (`aria-hidden`). There is no affiliation with any anime franchise.

## Deploying to Vercel (later — not done)

1. Push this folder to a Git repository.
2. In Vercel, “Add New Project” → import the repo. Framework is auto-detected as Next.js; no environment variables are required.
3. Optional: set `NEXT_PUBLIC_SITE_URL` (e.g. `https://your-domain`) for canonical URLs and the sitemap.
4. Every page is static or pre-rendered; there are no server functions, secrets, auth or database.

Check Vercel’s current plan limits when you deploy; nothing here assumes unlimited usage.
