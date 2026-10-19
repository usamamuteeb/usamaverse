'use client';

import { TransformTool } from '@/components/tool-kit/TransformTool';
import { str, type OptionDef } from '@/components/tool-kit/options';
import { formatHtml, minifyHtml } from './formatters';

const options: OptionDef[] = [{ type: 'select', key: 'mode', label: 'Output', default: '2', choices: [{ value: '2', label: 'Pretty — 2 spaces' }, { value: '4', label: 'Pretty — 4 spaces' }, { value: 'tab', label: 'Pretty — tabs' }, { value: 'min', label: 'Minified (drops comments)' }] }];

export default function HtmlFormatter() {
  return (
    <TransformTool
      inputLabel="HTML"
      options={options}
      example={'<!doctype html><html><head><title>Demo</title><style>body{margin:0}</style></head><body><nav><a href="/">Home</a> | <a href="/tools">Tools</a></nav><main><h1>Hello</h1><p>Some <b>bold</b> text.</p><ul><li>One</li><li>Two</li></ul></main><script>console.log(1 < 2)</script></body></html>'}
      transform={(t, v) => {
        const m = str(v.mode);
        return { output: m === 'min' ? minifyHtml(t) : formatHtml(t, m === 'tab' ? '\t' : ' '.repeat(Number(m))) };
      }}
      filename="formatted.html"
      mime="text/html"
    />
  );
}
