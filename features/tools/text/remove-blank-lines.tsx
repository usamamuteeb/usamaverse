'use client';

import { TransformTool } from '@/components/tool-kit/TransformTool';
import { bool, type OptionDef } from '@/components/tool-kit/options';
import { removeBlankLines } from './logic';

const options: OptionDef[] = [
  { type: 'checkbox', key: 'ws', label: 'Treat lines with only spaces as blank', default: true },
  { type: 'checkbox', key: 'collapse', label: 'Keep one blank line between paragraphs instead of removing all', default: false },
];

export default function RemoveBlankLines() {
  return (
    <TransformTool
      options={options}
      example={'First paragraph\n\n\n   \nSecond paragraph\n\nThird'}
      transform={(t, v) => {
        const r = removeBlankLines(t, { whitespaceIsBlank: bool(v.ws), collapse: bool(v.collapse) });
        return { output: r.output, summary: `${r.removed.toLocaleString()} blank line${r.removed === 1 ? '' : 's'} removed.` };
      }}
      filename="no-blank-lines.txt"
    />
  );
}
