'use client';

import { TransformTool } from '@/components/tool-kit/TransformTool';
import { bool, type OptionDef } from '@/components/tool-kit/options';
import { dedupeLines } from './logic';

const options: OptionDef[] = [
  { type: 'checkbox', key: 'caseSensitive', label: 'Case-sensitive (Apple ≠ apple)', default: true },
  { type: 'checkbox', key: 'trim', label: 'Ignore spaces at the start and end of lines', default: true },
  { type: 'checkbox', key: 'keepBlank', label: 'Keep blank lines', default: false },
];

export default function DuplicateLineRemover() {
  return (
    <TransformTool
      options={options}
      example={'apple\nbanana\napple\n Banana \ncherry'}
      transform={(t, v) => {
        const r = dedupeLines(t, { caseSensitive: bool(v.caseSensitive), trim: bool(v.trim), keepBlank: bool(v.keepBlank) });
        return { output: r.output, summary: `${r.removed.toLocaleString()} duplicate line${r.removed === 1 ? '' : 's'} removed.` };
      }}
      filename="unique-lines.txt"
    />
  );
}
