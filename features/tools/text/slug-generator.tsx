'use client';

import { TransformTool } from '@/components/tool-kit/TransformTool';
import { bool, str, type OptionDef } from '@/components/tool-kit/options';
import { slugify, splitLines } from './logic';

const options: OptionDef[] = [
  { type: 'select', key: 'separator', label: 'Separator', default: '-', choices: [{ value: '-', label: 'Hyphen (-)' }, { value: '_', label: 'Underscore (_)' }] },
  { type: 'checkbox', key: 'lowercase', label: 'Lowercase', default: true },
  { type: 'number', key: 'maxLength', label: 'Maximum length (0 = no limit)', default: '0' },
];

export default function SlugGenerator() {
  return (
    <TransformTool
      inputLabel="Titles (one per line)"
      inputRows={6}
      options={options}
      example={'10 Tips for Crème Brûlée & Café Latte!\nWhat’s New in 2026?'}
      transform={(t, v) => {
        const max = Math.max(0, Math.floor(Number(str(v.maxLength)) || 0));
        return { output: splitLines(t).map((l) => slugify(l, { separator: str(v.separator) as '-' | '_', lowercase: bool(v.lowercase), maxLength: max })).join('\n') };
      }}
    />
  );
}
