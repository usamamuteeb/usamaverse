import type { CategorySlug, ProcessingMode, ToolMeta, ToolPhase } from './types';

/**
 * Roadmap backlog. NOT public: nothing here is listed, searched, counted or
 * routed. Move an entry into registry.implemented.ts (and add a loader) only
 * when the tool really works.
 *
 * The brief's 210-item roadmap contains cross-category duplicates (stopwatch,
 * QR, UUID, checklist, contrast checker, random picker, file size units, CSV↔JSON…).
 * Each is kept once here, so this list is the de-duplicated backlog.
 */
function plan(
  slug: string,
  name: string,
  category: CategorySlug,
  phase: ToolPhase,
  description = '',
  processing: ProcessingMode = 'browser-local',
): ToolMeta {
  return {
    id: slug,
    slug,
    name,
    category,
    description,
    aliases: [],
    tags: [],
    phase,
    status: 'planned',
    processing,
    related: [],
  };
}

const B = 'launch-basic' as const;
const E = 'basic-expansion' as const;
const A = 'advanced' as const;

export const plannedTools: ToolMeta[] = [
  // Text

  // Developer
  plan('yaml-validator', 'YAML Validator', 'developer', E),
  plan('js-formatter', 'JavaScript Formatter', 'developer', E, 'Formats code without executing it.'),

  // Generators & security
  plan('passphrase-generator', 'Passphrase Generator', 'generators', B, 'Needs a vetted word list.'),

  // Image
  plan('svg-optimizer', 'SVG Optimizer (sanitized)', 'image', A),

  // Files / PDF / archives
  // PDF tools that need a server engine, an encryption library or a product decision
  plan('word-to-pdf', 'Word to PDF', 'pdf', A, 'Needs an office rendering engine (e.g. LibreOffice) on a server.', 'server-required'),
  plan('powerpoint-to-pdf', 'PowerPoint to PDF', 'pdf', A, 'Needs an office rendering engine on a server.', 'server-required'),
  plan('excel-to-pdf', 'Excel to PDF', 'pdf', A, 'Needs an office rendering engine on a server.', 'server-required'),
  plan('html-to-pdf', 'HTML to PDF', 'pdf', A, 'Safe rendering of arbitrary HTML/URLs needs isolation; deferred.'),
  plan('pdf-to-word', 'PDF to Word', 'pdf', A, 'Editable layout reconstruction needs a dedicated engine.'),
  plan('pdf-to-powerpoint', 'PDF to PowerPoint', 'pdf', A, 'Editable reconstruction needs a dedicated engine.'),
  plan('pdf-to-excel', 'PDF to Excel', 'pdf', A, 'Table detection needs a dedicated engine and test corpus.'),
  plan('pdf-to-pdfa', 'PDF to PDF/A', 'pdf', A, 'Needs a conforming writer plus veraPDF validation.'),
  plan('protect-pdf', 'Protect PDF (password)', 'pdf', A, 'Needs a verified PDF encryption engine (pdf-lib cannot encrypt).'),
  plan('unlock-pdf', 'Unlock PDF', 'pdf', A, 'Needs a verified decryption engine; with the correct password only.'),
  plan('ocr-pdf', 'OCR PDF', 'pdf', A, 'Excluded for now: requires an explicit decision on OCR models.'),
  plan('pdf-workflow', 'PDF Workflow Builder', 'pdf', A, 'Chain existing PDF tools into a reusable recipe.'),
  plan('pdf-image-extract', 'PDF Image Extractor', 'pdf', A),
  plan('zip-extract', 'ZIP Extractor', 'files', A, 'Needs path-traversal and zip-bomb defenses.'),

  // Math

  // Units
  plan('shoe-size-converter', 'Shoe & Clothing Sizes', 'units', A, 'Region-specific; approximate.'),

  // Dates

  // Color & design
  plan('color-blindness-simulator', 'Color Vision Simulator', 'color', A, 'A simulation, not certification.'),

  // Web
  plan('html-analyzer', 'Pasted HTML Analyzer', 'web', A, 'Pasted HTML only, no fetching.'),

  // CSV
  plan('formula-helper', 'Spreadsheet Formula Helper', 'csv', E, 'Generates formulas only.'),

  // Media
  plan('audio-inspector', 'Audio Inspector', 'media', A),
  plan('video-inspector', 'Video Inspector', 'media', A),
  plan('audio-trim', 'Audio Trimmer', 'media', A),
  plan('video-trim', 'Video Trimmer', 'media', A),
  plan('audio-adjust', 'Audio Volume Adjuster', 'media', A),
  plan('media-join', 'Media Joiner', 'media', A),
  plan('media-convert', 'Media Converter', 'media', A),
  plan('video-mute', 'Mute Video', 'media', A),
  plan('extract-audio', 'Extract Audio from Video', 'media', A),
  plan('video-thumbnail', 'Video Thumbnail Grabber', 'media', A),
  plan('gif-frame-inspector', 'GIF Frame Inspector', 'media', A),

  // Language & everyday
  plan('emoji-search', 'Emoji Search (local)', 'language', E),
  plan('keyboard-layout-helper', 'Keyboard Layout Helper', 'language', A),

  // Misc
  plan('qr-reader', 'QR Code Reader (image)', 'misc', A),
  plan('barcode-reader', 'Barcode Reader (image)', 'misc', A),
  plan('invoice-template', 'Invoice Template', 'misc', A, 'No legal or tax claims.'),
  plan('label-printer', 'Printable Labels', 'misc', A),
  plan('screen-ruler', 'Screen Ruler', 'misc', A, 'Physical calibration caveat.'),
];
