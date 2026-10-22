import type { ToolMeta } from './types';
import { impl } from './registry.helpers';

const E = 'basic-expansion' as const;

/** Extra everyday tools added with the CV & LaTeX batch (metadata only). */
export const extraTools: ToolMeta[] = [
  impl({
    slug: 'invoice-generator',
    name: 'Invoice Generator',
    category: 'misc',
    phase: E,
    description: 'Create a professional invoice with line items, tax, discount and totals, then download a PDF — no sign-up.',
    aliases: ['invoice maker', 'free invoice', 'invoice template', 'bill generator', 'freelance invoice', 'receipt maker'],
    tags: ['invoice', 'business', 'pdf', 'freelance'],
    related: ['invoice-number-generator', 'cv-builder'],
    howTo: ['Fill in your details, the client and the line items.', 'Check the live preview and totals.', 'Download the PDF or print it; save the data as .json to reuse it later.'],
    limits: ['Totals are calculated exactly in cents, but tax rules differ by country — this tool does not give tax or legal advice.', 'The direct PDF uses standard fonts (Western European characters); use Print / Save as PDF for other scripts.'],
  }),
  impl({
    slug: 'placeholder-image',
    name: 'Placeholder Image Generator',
    category: 'image',
    phase: E,
    description: 'Make placeholder images of any size and colour with a label, as PNG, JPEG, WebP or SVG.',
    aliases: ['placeholder image', 'dummy image', 'placehold', 'mockup image', 'blank image generator', 'image of size'],
    tags: ['image', 'placeholder', 'design', 'mockup'],
    related: ['social-image-canvas', 'favicon-generator'],
  }),
  impl({
    slug: 'color-blindness-simulator',
    name: 'Color Blindness Simulator',
    category: 'color',
    phase: E,
    description: 'See an image or palette as people with protanopia, deuteranopia, tritanopia or achromatopsia would.',
    aliases: ['color blind simulator', 'colour blindness', 'cvd simulator', 'deuteranopia', 'protanopia', 'accessibility colors'],
    tags: ['color', 'accessibility', 'image'],
    related: ['contrast-checker', 'palette-generator'],
    limits: ['A simulation (Machado et al., 2009) for design checks — not a diagnosis, and real colour vision varies between people.'],
  }),
];
