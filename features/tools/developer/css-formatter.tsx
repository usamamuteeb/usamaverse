'use client';

import { TransformTool } from '@/components/tool-kit/TransformTool';
import { str, type OptionDef } from '@/components/tool-kit/options';
import { formatCss, minifyCss } from './formatters';

const options: OptionDef[] = [{ type: 'select', key: 'mode', label: 'Output', default: '2', choices: [{ value: '2', label: 'Pretty — 2 spaces' }, { value: '4', label: 'Pretty — 4 spaces' }, { value: 'min', label: 'Minified (keeps /*! */ comments)' }] }];

export default function CssFormatter() {
  return (
    <TransformTool
      inputLabel="CSS"
      options={options}
      example={'/* Card */ .card,.panel{padding:16px;border:1px solid #333;box-shadow:0 1px 2px rgb(0 0 0 / .2)}@media (max-width:600px){.card{padding:calc(1rem + 2px)}}'}
      transform={(t, v) => {
        const m = str(v.mode);
        const output = m === 'min' ? minifyCss(t) : formatCss(t, ' '.repeat(Number(m)));
        return { output, summary: m === 'min' ? `${t.length.toLocaleString()} → ${output.length.toLocaleString()} characters.` : undefined };
      }}
      filename="styles.css"
      mime="text/css"
    />
  );
}
