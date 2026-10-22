import type { CategorySlug } from '@/lib/tools/types';

export const categoryEmoji: Record<CategorySlug, string> = {
  text: '✍️', developer: '🧩', generators: '🔐', image: '🖼️', pdf: '📄',
  files: '📁', math: '🧮', units: '📏', dates: '⏱️', color: '🎨',
  web: '🌐', csv: '📊', media: '🎬', language: '🌍', career: '💼', latex: '∑', misc: '✨',
};

export const workspaceEmoji: Record<string, string> = {
  'pdf-editor': '📝', 'pdf-pages': '📚', 'image-editor': '🖼️',
  'text-editor': '✍️', 'data-formats': '🧩', 'csv-workspace': '📊',
  'cv-studio': '🧾', 'job-applications': '📨', 'contact-cards': '📇', 'latex-converter': '🔁', 'latex-builders': '🧱',
  'audio-studio': '🎧', 'media-planner': '🎬',
};
