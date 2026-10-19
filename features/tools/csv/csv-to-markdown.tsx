'use client';

import { TransformTool } from '@/components/tool-kit/TransformTool';
import { bool, str, type OptionDef } from '@/components/tool-kit/options';
import { csvToMarkdown } from './logic';

const options: OptionDef[] = [
  { type: 'select', key: 'delimiter', label: 'Delimiter', default: 'auto', choices: [{ value: 'auto', label: 'Detect automatically' }, { value: ',', label: 'Comma' }, { value: ';', label: 'Semicolon' }, { value: 'tab', label: 'Tab' }, { value: '|', label: 'Pipe' }] },
  { type: 'checkbox', key: 'header', label: 'First row is a header', default: true },
  { type: 'select', key: 'align', label: 'Column alignment', default: 'none', choices: [{ value: 'none', label: 'Default' }, { value: 'left', label: 'Left' }, { value: 'center', label: 'Center' }, { value: 'right', label: 'Right' }] },
];

export default function CsvToMarkdown() {
  return (
    <TransformTool
      inputLabel="CSV"
      options={options}
      example={'Tool,Category,Local\nWord counter,Text,Yes\n"CSV, viewer",Spreadsheet,Yes'}
      transform={(t, v) => ({ output: csvToMarkdown(t, { delimiter: str(v.delimiter), header: bool(v.header), align: str(v.align) as 'none' }) })}
      filename="table.md"
      mime="text/markdown"
    />
  );
}
