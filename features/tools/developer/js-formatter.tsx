'use client';

import { TransformTool } from '@/components/tool-kit/TransformTool';
import { str, type OptionDef } from '@/components/tool-kit/options';
import { compactJs, formatJs } from './js-format';

const options: OptionDef[] = [
  {
    type: 'select',
    key: 'mode',
    label: 'Output',
    default: '2',
    choices: [
      { value: '2', label: 'Pretty — 2 spaces' },
      { value: '4', label: 'Pretty — 4 spaces' },
      { value: 'tab', label: 'Pretty — tabs' },
      { value: 'compact', label: 'Compact (drops comments, keeps line breaks)' },
    ],
  },
];

const looksLikeJsx = (s: string) => /(return|=>|\()\s*<[A-Za-z>]/.test(s);

export default function JsFormatter() {
  return (
    <TransformTool
      inputLabel="JavaScript or TypeScript"
      options={options}
      example={"import {sum,avg} from './math';const prices=[120,80,45.5];\nfunction total(items,tax=0.17){let t=0;for(const p of items){t+=p}return Math.round(t*(1+tax)*100)/100}\nconst report={count:prices.length,total:total(prices),label:`Total: ${total(prices)}`};if(report.total>200){console.log('big order',report)}else{console.log(\"small\")}"}
      transform={(t, v) => {
        const m = str(v.mode);
        const output = m === 'compact' ? compactJs(t) : formatJs(t, m === 'tab' ? '\t' : ' '.repeat(Number(m)));
        return {
          output,
          summary: `${t.split('\n').length.toLocaleString()} → ${output.trimEnd().split('\n').length.toLocaleString()} lines.`,
          warning: looksLikeJsx(t) ? 'JSX tags are copied as plain tokens and may not be laid out nicely.' : undefined,
        };
      }}
      filename="formatted.js"
      mime="text/javascript"
    />
  );
}
