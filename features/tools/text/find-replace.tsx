'use client';

import { TransformTool } from '@/components/tool-kit/TransformTool';
import { bool, str, type OptionDef } from '@/components/tool-kit/options';
import { findReplace } from './logic';

const options: OptionDef[] = [
  { type: 'text', key: 'find', label: 'Find', default: '', placeholder: 'Text to find' },
  { type: 'text', key: 'replace', label: 'Replace with', default: '', placeholder: 'Leave empty to delete matches' },
  { type: 'checkbox', key: 'caseSensitive', label: 'Match case', default: false },
  { type: 'checkbox', key: 'wholeWord', label: 'Whole words only', default: false },
];

export default function FindReplace() {
  return (
    <TransformTool
      inputLabel="Text"
      options={options}
      example="The cat sat on the mat. Category: cats."
      transform={(t, v) => {
        if (!str(v.find)) return { output: t, summary: 'Enter text to find.' };
        const r = findReplace(t, str(v.find), str(v.replace), { caseSensitive: bool(v.caseSensitive), wholeWord: bool(v.wholeWord) });
        return { output: r.output, summary: `${r.count.toLocaleString()} replacement${r.count === 1 ? '' : 's'} made.` };
      }}
      filename="replaced.txt"
    />
  );
}
