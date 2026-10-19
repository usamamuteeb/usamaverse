'use client';

import { TransformTool } from '@/components/tool-kit/TransformTool';
import { bool, str, type OptionDef } from '@/components/tool-kit/options';
import { textToColumns, type OutputMode, type SplitMode } from './columns';

const options: OptionDef[] = [
  { type: 'select', key: 'split', label: 'Split each line on', default: 'comma', choices: [{ value: 'comma', label: 'Comma' }, { value: 'tab', label: 'Tab' }, { value: 'semicolon', label: 'Semicolon' }, { value: 'pipe', label: 'Pipe |' }, { value: 'spaces', label: 'Runs of spaces' }, { value: 'csv', label: 'CSV (respects quotes)' }, { value: 'custom', label: 'Custom…' }] },
  { type: 'text', key: 'custom', label: 'Custom delimiter', default: '' },
  { type: 'select', key: 'output', label: 'Output as', default: 'aligned', choices: [{ value: 'aligned', label: 'Aligned columns (plain text)' }, { value: 'markdown', label: 'Markdown table' }, { value: 'csv', label: 'CSV' }, { value: 'tsv', label: 'TSV (paste into spreadsheets)' }] },
  { type: 'checkbox', key: 'trim', label: 'Trim spaces in each cell', default: true },
];

export default function TextToColumns() {
  return (
    <TransformTool
      options={options}
      example={'Name, City, Score\nAli, Lahore, 91\nSara Khan, Karachi, 88'}
      transform={(t, v) => {
        const r = textToColumns(t, { split: str(v.split) as SplitMode, custom: str(v.custom), output: str(v.output) as OutputMode, trim: bool(v.trim) });
        return { output: r.output, summary: `${r.rows} rows × ${r.columns} columns.` };
      }}
    />
  );
}
