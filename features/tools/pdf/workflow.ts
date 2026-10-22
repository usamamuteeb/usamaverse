import { loadPdf, parsePageRanges, rotatePdf } from '@/features/tools/files/pdf';
import { addPageNumbers, addTextWatermark, optimizePdf, removePages } from './ops';

export type WorkflowStep =
  | { kind: 'rotate'; pages: string; angle: 90 | 180 | 270 }
  | { kind: 'remove'; pages: string }
  | { kind: 'numbers'; pages: string; startAt: number }
  | { kind: 'watermark'; pages: string; text: string; color: string; opacity: number }
  | { kind: 'metadata'; title: string; author: string }
  | { kind: 'optimize' };
export type StepKind = WorkflowStep['kind'];

export function defaultWorkflowStep(kind: StepKind): WorkflowStep {
  switch (kind) {
    case 'rotate': return { kind, pages: 'all', angle: 90 };
    case 'remove': return { kind, pages: 'last' };
    case 'numbers': return { kind, pages: 'all', startAt: 1 };
    case 'watermark': return { kind, pages: 'all', text: 'DRAFT', color: '#c6283d', opacity: 0.25 };
    case 'metadata': return { kind, title: '', author: '' };
    case 'optimize': return { kind };
  }
}

export function parseWorkflowRecipe(raw: string): WorkflowStep[] {
  const value: unknown = JSON.parse(raw);
  if (!Array.isArray(value) || !value.length || value.length > 20) throw new Error('A recipe needs 1–20 steps.');
  return value.map((input: unknown, index) => {
    if (!input || typeof input !== 'object') throw new Error(`Step ${index + 1} is invalid.`);
    const s = input as Record<string, unknown>;
    const text = (key: string, max = 500) => {
      if (typeof s[key] !== 'string' || s[key].length > max) throw new Error(`Step ${index + 1}: invalid ${key}.`);
      return s[key] as string;
    };
    switch (s.kind) {
      case 'rotate': { const pages = text('pages', 100); if (![90, 180, 270].includes(Number(s.angle))) throw new Error('Rotation must be 90°, 180° or 270°.'); return { kind: 'rotate', pages, angle: Number(s.angle) as 90 | 180 | 270 }; }
      case 'remove': return { kind: 'remove', pages: text('pages', 100) };
      case 'numbers': { const pages = text('pages', 100); const startAt = Number(s.startAt); if (!Number.isInteger(startAt) || startAt < 0 || startAt > 1000000) throw new Error('Invalid first page number.'); return { kind: 'numbers', pages, startAt }; }
      case 'watermark': { const pages = text('pages', 100); const content = text('text', 100); const color = text('color', 7); const opacity = Number(s.opacity); if (!/^#[0-9a-f]{6}$/i.test(color) || !Number.isFinite(opacity) || opacity <= 0 || opacity > 1) throw new Error('Invalid watermark color or opacity.'); return { kind: 'watermark', pages, text: content, color, opacity }; }
      case 'metadata': return { kind: 'metadata', title: text('title'), author: text('author') };
      case 'optimize': return { kind: 'optimize' };
      default: throw new Error(`Step ${index + 1} is not a supported PDF action.`);
    }
  });
}

export async function runPdfWorkflow(source: Uint8Array, recipe: WorkflowStep[], onStep?: (index: number) => void): Promise<Uint8Array> {
  const steps = parseWorkflowRecipe(JSON.stringify(recipe));
  let bytes = source;
  for (let i = 0; i < steps.length; i++) {
    onStep?.(i);
    const s = steps[i];
    switch (s.kind) {
      case 'rotate': bytes = await rotatePdf(bytes, s.pages, s.angle); break;
      case 'remove': { const doc = await loadPdf(bytes); bytes = await removePages(bytes, parsePageRanges(s.pages, doc.getPageCount())); break; }
      case 'numbers': bytes = await addPageNumbers(bytes, { pages: s.pages, startAt: s.startAt, format: 'n', anchor: 'bottom-center', margin: 28, fontSize: 11, color: '#222222', opacity: 1, font: 'Helvetica', facing: false }); break;
      case 'watermark': bytes = await addTextWatermark(bytes, { pages: s.pages, text: s.text, color: s.color, opacity: s.opacity, fontSize: 42, angle: -30, layout: 'center', font: 'HelveticaBold' }); break;
      case 'metadata': { const doc = await loadPdf(bytes); if (s.title) doc.setTitle(s.title); if (s.author) doc.setAuthor(s.author); bytes = await doc.save(); break; }
      case 'optimize': bytes = (await optimizePdf(bytes, { removeMetadata: false })).bytes; break;
    }
  }
  return bytes;
}
