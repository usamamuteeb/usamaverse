import { publicTools } from './public';
import type { CategorySlug, ToolMeta } from './types';

export interface ToolWorkspace {
  slug: string;
  name: string;
  description: string;
  category: CategorySlug;
  tools: ToolMeta[];
}

// One task-focused home for each tool. The old /tools/[slug] URLs remain available.
const groups: Array<[string, string, string, CategorySlug, string]> = [
  ['text-inspector', 'Text insights', 'Counts, reading time and character details in one place.', 'text', 'word-counter line-counter reading-time char-frequency'],
  ['text-editor', 'Text editor', 'Clean, reshape, sort and replace text.', 'text', 'case-converter whitespace-cleaner duplicate-line-remover line-sorter find-replace text-reverser remove-blank-lines text-to-columns'],
  ['text-compare', 'Compare text', 'Find changes between two versions.', 'text', 'text-diff'],
  ['text-maker', 'Text and slugs', 'Generate placeholder copy and clean URLs.', 'text', 'lorem-ipsum slug-generator'],
  ['data-formats', 'Data formats', 'Format, validate and convert JSON, YAML, XML, HTML, CSS, JavaScript and SQL.', 'developer', 'json-formatter yaml-validator json-csv-converter xml-formatter html-formatter css-formatter js-formatter sql-formatter'],
  ['encoding', 'Encode and decode', 'Work with Base64, entities, URLs and data files.', 'developer', 'html-entities url-encoder base64-text base64-file'],
  ['developer-inspector', 'Developer inspector', 'Inspect tokens, patterns, dates, schedules and patches.', 'developer', 'jwt-decoder regex-tester unix-timestamp cron-explainer diff-patch-viewer'],
  ['markdown-workspace', 'Markdown workspace', 'Preview Markdown and build tables.', 'developer', 'markdown-preview'],
  ['secure-generators', 'Secure generators', 'Create passwords, passphrases, PINs, random values and IDs.', 'generators', 'password-generator passphrase-generator random-number random-string pin-generator uuid-generator'],
  ['checksums', 'Hashes and checksums', 'Calculate and inspect hashes and message authentication codes.', 'generators', 'hash-generator hmac-generator crc32-checksum bcrypt-cost-explainer password-strength-meter'],
  ['codes', 'QR and barcodes', 'Create scannable QR and product codes.', 'generators', 'qr-generator barcode-generator'],
  ['code-readers', 'Scan QR and barcodes', 'Read codes from local images.', 'misc', 'qr-reader barcode-reader'],
  ['image-editor', 'Image editor', 'Resize, crop, compress, rotate and inspect photos.', 'image', 'image-resize image-compress image-crop image-rotate-flip image-metadata exif-orientation-fixer image-color-picker'],
  ['image-converter', 'Image converter', 'Convert formats and image data.', 'image', 'png-to-jpeg jpeg-to-png image-to-webp webp-to-image image-to-base64 base64-to-image'],
  ['design-assets', 'Design assets', 'Make favicons, social images and placeholders; clean up SVGs.', 'image', 'favicon-generator social-image-canvas placeholder-image svg-optimizer'],
  ['pdf-editor', 'PDF editor', 'Write, draw, sign and fill directly on PDF pages.', 'pdf', 'edit-pdf sign-pdf pdf-forms redact-pdf'],
  ['pdf-pages', 'PDF pages', 'Combine, split, extract, rotate and organize pages.', 'pdf', 'pdf-merge pdf-split pdf-page-extract pdf-rotate pdf-reorder organize-pdf remove-pages'],
  ['pdf-converter', 'PDF converter', 'Convert PDF pages, Office files, HTML, text and images locally.', 'pdf', 'pdf-to-image pdf-image-extract pdf-to-text images-to-pdf scan-to-pdf ocr-pdf word-to-pdf powerpoint-to-pdf excel-to-pdf html-to-pdf pdf-to-word pdf-to-powerpoint pdf-to-excel pdf-to-pdfa'],
  ['pdf-finish', 'PDF finishing', 'Add numbers and watermarks, crop and compress.', 'pdf', 'pdf-page-numbers pdf-watermark crop-pdf compress-pdf'],
  ['pdf-inspector', 'PDF inspector', 'Compare, repair and inspect document details.', 'pdf', 'repair-pdf compare-pdf pdf-metadata'],
  ['pdf-workflows', 'PDF workflows', 'Chain page edits and finishing steps into reusable recipes.', 'pdf', 'pdf-workflow'],
  ['pdf-security', 'PDF security', 'Add or remove a known password to control PDF opening.', 'pdf', 'protect-pdf unlock-pdf'],
  ['file-workspace', 'File workspace', 'Inspect, hash, combine and archive local files.', 'files', 'file-type-inspector file-hash text-file-merger zip-create zip-extract'],
  ['everyday-math', 'Everyday math', 'Calculate percentages, fractions, averages and statistics.', 'math', 'basic-calculator scientific-calculator fraction-calculator percentage-calculator average-calculator median-mode random-picker'],
  ['money-math', 'Money calculators', 'Work out tips, discounts, tax, loans and interest.', 'math', 'tip-calculator discount-calculator sales-tax-calculator loan-calculator interest-calculator'],
  ['grades-and-bases', 'Grades and bases', 'Calculate GPA and convert number bases.', 'math', 'gpa-calculator number-base-converter'],
  ['everyday-units', 'Everyday units', 'Convert measurements used at home and work.', 'units', 'length-converter mass-converter temperature-converter area-converter volume-converter cooking-volume-converter shoe-size-converter'],
  ['science-units', 'Science units', 'Convert motion, force, energy and other physical quantities.', 'units', 'speed-converter pressure-converter energy-converter power-converter force-converter angle-converter frequency-converter fuel-economy-converter'],
  ['digital-units', 'Digital and time units', 'Convert storage, duration and typography measurements.', 'units', 'duration-converter data-size-converter typography-units'],
  ['date-calculator', 'Date calculator', 'Find intervals, ages, weekdays and business days.', 'dates', 'date-difference date-add-subtract age-calculator week-number business-days weekday-finder iso-date-formatter time-duration-calculator'],
  ['timers', 'Timers', 'Run a stopwatch or countdown.', 'dates', 'stopwatch countdown-timer countdown-to-date'],
  ['world-time', 'World time', 'Compare time zones and plan meetings.', 'dates', 'timezone-converter world-clock meeting-planner'],
  ['color-workspace', 'Color studio', 'Pick, convert, compare and combine colors.', 'color', 'color-converter color-picker contrast-checker palette-generator gradient-generator color-blindness-simulator'],
  ['css-design', 'CSS design', 'Build shadows, corners and responsive type.', 'color', 'box-shadow-generator border-radius-generator type-scale clamp-calculator'],
  ['display-math', 'Display measurements', 'Calculate aspect ratios, resolution and pixel density.', 'color', 'aspect-ratio-calculator ppi-calculator'],
  ['url-workspace', 'URL workspace', 'Inspect, build, clean and extract links.', 'web', 'url-parser query-string-builder utm-builder url-cleaner url-extractor data-uri-encoder'],
  ['seo-workspace', 'SEO & page checks', 'Audit page HTML and build meta tags, robots rules and sitemaps.', 'web', 'html-analyzer meta-tag-generator robots-txt-generator sitemap-generator'],
  ['web-reference', 'Web reference', 'Look up MIME types, status codes and user agents.', 'web', 'mime-lookup http-status-codes user-agent-parser'],
  ['csv-workspace', 'CSV workspace', 'View, clean, sort, filter and convert tables.', 'csv', 'csv-viewer csv-to-markdown csv-delimiter-detector csv-column-selector csv-duplicate-finder csv-sort csv-filter tsv-csv-converter formula-helper'],
  ['audio-studio', 'Audio studio', 'Inspect, trim, adjust, join and extract audio.', 'media', 'audio-inspector audio-trim audio-adjust media-join extract-audio'],
  ['media-planner', 'Video tools', 'Inspect, trim, mute and convert videos, grab frames, and step through GIFs.', 'media', 'video-inspector video-thumbnail video-trim video-mute media-convert gif-frame-inspector media-size-estimator'],
  ['characters-and-codes', 'Characters and codes', 'Explore emoji, Unicode, numerals, keyboard layouts and text encodings.', 'language', 'roman-numerals unicode-inspector emoji-search number-to-words text-to-binary keyboard-layout-helper'],
  ['communication-codes', 'Communication codes', 'Translate Morse, phonetic spelling and Braille.', 'language', 'morse-code nato-alphabet braille-reference'],
  ['cv-studio', 'CV studio', 'Build a CV and convert it to and from LaTeX, PDF and Word.', 'career', 'cv-builder cv-to-latex latex-to-cv'],
  ['job-applications', 'Job applications', 'Write cover letters and tune your CV to a job posting.', 'career', 'cover-letter-generator resume-keyword-matcher resume-bullet-checker'],
  ['contact-cards', 'Contact cards', 'Share your details as a vCard, QR code or email signature.', 'career', 'vcard-generator email-signature-generator'],
  ['latex-converter', 'LaTeX converter', 'Convert between LaTeX, Markdown and text, escape characters and count words.', 'latex', 'markdown-to-latex latex-to-markdown latex-escape latex-word-count'],
  ['latex-builders', 'LaTeX builders', 'Make tables, citations and find symbols.', 'latex', 'latex-table-generator bibtex-generator bibtex-formatter latex-symbols'],
  ['tables-and-lists', 'Tables and lists', 'Build tables, checklists and reference numbers.', 'misc', 'markdown-table-generator html-table-generator checklist'],
  ['business-documents', 'Business documents', 'Create invoices, labels and reference numbers.', 'misc', 'invoice-generator invoice-number-generator label-printer'],
  ['screen-measure', 'Screen measure', 'Measure pixels and calibrated physical lengths on screen.', 'misc', 'screen-ruler'],
];

const bySlug = new Map(publicTools.map((tool) => [tool.slug, tool]));

export const workspaces: ToolWorkspace[] = groups.map(([slug, name, description, category, slugs]) => ({
  slug,
  name,
  description,
  category,
  tools: slugs.split(' ').map((item) => {
    const tool = bySlug.get(item);
    if (!tool) throw new Error(`Workspace ${slug} references unknown tool ${item}`);
    if (tool.category !== category && !(slug === 'tables-and-lists' && item === 'checklist') && !(slug === 'text-inspector' && item === 'char-frequency') && !(slug === 'secure-generators' && item === 'uuid-generator')) throw new Error(`Workspace ${slug} has a mismatched tool ${item}`);
    return tool;
  }),
}));

const workspaceBySlug = new Map(workspaces.map((workspace) => [workspace.slug, workspace]));
const workspaceByTool = new Map(workspaces.flatMap((workspace) => workspace.tools.map((tool) => [tool.slug, workspace] as const)));

export const getWorkspace = (slug: string) => workspaceBySlug.get(slug);
export const workspaceForTool = (slug: string) => workspaceByTool.get(slug);
export const workspacesInCategory = (category: string) => workspaces.filter((workspace) => workspace.category === category);
