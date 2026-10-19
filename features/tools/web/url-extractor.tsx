'use client';

import { TransformTool } from '@/components/tool-kit/TransformTool';
import { bool, str, type OptionDef } from '@/components/tool-kit/options';
import { extractUrls } from './logic';

const options: OptionDef[] = [
  { type: 'select', key: 'mode', label: 'Extract', default: 'urls', choices: [{ value: 'urls', label: 'Full URLs' }, { value: 'domains', label: 'Domains only' }] },
  { type: 'checkbox', key: 'unique', label: 'Remove duplicates', default: true },
];

export default function UrlExtractor() {
  return (
    <TransformTool
      inputLabel="Text containing links"
      options={options}
      example={'Read https://en.wikipedia.org/wiki/URL (and https://example.com/a?b=1). Mirror: www.example.com, again https://example.com/a?b=1.'}
      transform={(t, v) => {
        const list = extractUrls(t, { unique: bool(v.unique), mode: str(v.mode) as 'urls' });
        return { output: list.join('\n'), summary: `${list.length.toLocaleString()} found.` };
      }}
      filename="links.txt"
    />
  );
}
