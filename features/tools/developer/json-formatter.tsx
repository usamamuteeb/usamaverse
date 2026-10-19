'use client';

import { TransformTool } from '@/components/tool-kit/TransformTool';
import { bool, str, type OptionDef } from '@/components/tool-kit/options';
import { formatJson, hasUnsafeIntegers } from './logic';

const options: OptionDef[] = [
  { type: 'select', key: 'indent', label: 'Output', default: '2', choices: [{ value: '2', label: 'Pretty — 2 spaces' }, { value: '4', label: 'Pretty — 4 spaces' }, { value: 'tab', label: 'Pretty — tabs' }, { value: 'minify', label: 'Minified' }] },
  { type: 'checkbox', key: 'sortKeys', label: 'Sort object keys A–Z', default: false },
];

export default function JsonFormatter() {
  return (
    <TransformTool
      inputLabel="JSON"
      placeholder='{"paste": "your JSON here"}'
      options={options}
      example={'{"name":"UsamaVerse","tools":["json","csv"],"nested":{"ok":true,"count":2}}'}
      transform={(t, v) => {
        const output = formatJson(t, { indent: str(v.indent) as '2', sortKeys: bool(v.sortKeys) });
        return {
          output,
          summary: 'Valid JSON.',
          warning: hasUnsafeIntegers(t) ? 'This JSON contains integers larger than JavaScript can represent exactly; they may have been rounded in the output.' : undefined,
        };
      }}
      filename="formatted.json"
      mime="application/json"
    />
  );
}
