import type { Category, CategorySlug } from './types';

export const categories: Category[] = [
  { slug: 'text', name: 'Text', description: 'Count, clean, sort, compare and reshape text.' },
  { slug: 'developer', name: 'Developer & data', description: 'Format, encode, decode and inspect data formats.' },
  { slug: 'generators', name: 'Generators & security', description: 'Secure random values, passwords and hashes.' },
  { slug: 'image', name: 'Image', description: 'Resize, compress, convert and rotate images in your browser.' },
  { slug: 'pdf', name: 'PDF', description: 'Merge, split, organize, convert, sign and edit PDFs — in your browser.' },
  { slug: 'files', name: 'Files', description: 'Inspect and combine files without uploading them.' },
  { slug: 'math', name: 'Math & calculators', description: 'Everyday calculators and number conversions.' },
  { slug: 'units', name: 'Units', description: 'Convert length, mass, temperature, data size and more.' },
  { slug: 'dates', name: 'Dates & time', description: 'Date differences, ages, stopwatches and timers.' },
  { slug: 'color', name: 'Color & design', description: 'Convert colors, check contrast and build gradients.' },
  { slug: 'web', name: 'Web & URL', description: 'Parse, build and extract URLs without fetching anything.' },
  { slug: 'csv', name: 'Spreadsheet & CSV', description: 'View and convert CSV data.' },
  { slug: 'media', name: 'Audio & video', description: 'Media helpers.' },
  { slug: 'language', name: 'Language & everyday', description: 'Characters, numerals and everyday helpers.' },
  { slug: 'career', name: 'CV & career', description: 'Build a CV, convert it to and from LaTeX, and prepare job applications.' },
  { slug: 'latex', name: 'LaTeX & academic', description: 'Convert, escape and build LaTeX — tables, citations and symbols.' },
  { slug: 'misc', name: 'Miscellaneous', description: 'Handy one-off utilities.' },
];

const bySlug = new Map(categories.map((c) => [c.slug, c]));

export function getCategory(slug: string): Category | undefined {
  return bySlug.get(slug as CategorySlug);
}

export function isCategorySlug(slug: string): slug is CategorySlug {
  return bySlug.has(slug as CategorySlug);
}
