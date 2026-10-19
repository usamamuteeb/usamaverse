'use client';

import { GeneratorTool } from '@/components/tool-kit/GeneratorTool';
import { bool, str, type OptionDef } from '@/components/tool-kit/options';
import { randomIndex, shuffle } from '@/lib/tools/shared/random';

const options: OptionDef[] = [
  { type: 'text', key: 'items', label: 'Items (separate with commas)', default: 'Ali, Sara, Omar, Ayesha, Bilal', placeholder: 'Option A, Option B, Option C' },
  { type: 'number', key: 'count', label: 'How many to pick', default: '1' },
  { type: 'checkbox', key: 'unique', label: 'No repeats', default: true },
  { type: 'checkbox', key: 'shuffle', label: 'Instead, shuffle the whole list', default: false },
];

function pick(v: Record<string, string | boolean>): string {
  const items = str(v.items)
    .split(/[\n,]+/)
    .map((s) => s.trim())
    .filter(Boolean);
  if (items.length < 2) throw new Error('Enter at least two items.');
  if (items.length > 10_000) throw new Error('Up to 10,000 items.');
  if (bool(v.shuffle)) return shuffle(items).join('\n');
  const n = Number(str(v.count));
  if (!Number.isInteger(n) || n < 1) throw new Error('Pick at least 1.');
  if (bool(v.unique)) {
    if (n > items.length) throw new Error(`Only ${items.length} items to choose from.`);
    return shuffle(items).slice(0, n).join('\n');
  }
  if (n > 1000) throw new Error('Pick up to 1,000 at a time.');
  return Array.from({ length: n }, () => items[randomIndex(items.length)]).join('\n');
}

export default function RandomPicker() {
  return <GeneratorTool options={options} generate={pick} outputLabel="Picked" buttonLabel="Pick again" note={<p className="field-hint">Uses the browser’s cryptographic random generator, so every item has an equal chance.</p>} />;
}
