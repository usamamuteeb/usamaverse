'use client';

import { TransformTool } from '@/components/tool-kit/TransformTool';
import { bool, str, type OptionDef } from '@/components/tool-kit/options';
import { latexEscape, latexUnescape } from './escape';

const options: OptionDef[] = [
  { type: 'select', key: 'mode', label: 'Direction', default: 'escape', choices: [{ value: 'escape', label: 'Text → LaTeX (escape)' }, { value: 'unescape', label: 'LaTeX → text (unescape)' }] },
  { type: 'checkbox', key: 'lines', label: 'Keep line breaks (adds \\\\)', default: false, hint: 'Only used when escaping.' },
];

export default function LatexEscape() {
  return (
    <TransformTool
      inputLabel="Text"
      example={'Profit rose 25% to $1,200 & costs fell (see note #3).\nfile_name ~ {braces} ^ \\backslash <tag>'}
      options={options}
      filename="escaped.tex"
      transform={(t, v) => {
        const out = str(v.mode) === 'unescape' ? latexUnescape(t) : latexEscape(t, { keepNewlines: bool(v.lines) });
        const n = str(v.mode) === 'unescape' ? 0 : (t.match(/[\\{}&%$#_~^<>|]/g) ?? []).length;
        return { output: out, summary: str(v.mode) === 'unescape' ? undefined : `${n} special character${n === 1 ? '' : 's'} escaped` };
      }}
    />
  );
}
