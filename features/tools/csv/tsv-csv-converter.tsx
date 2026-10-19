'use client';

import { TransformTool } from '@/components/tool-kit/TransformTool';
import { str, type OptionDef } from '@/components/tool-kit/options';
import { convertDelimiter } from './logic';

const options: OptionDef[] = [
  { type: 'select', key: 'from', label: 'From', default: 'tab', choices: [{ value: 'tab', label: 'TSV (tab)' }, { value: ',', label: 'CSV (comma)' }, { value: ';', label: 'Semicolon' }, { value: '|', label: 'Pipe' }, { value: 'auto', label: 'Detect' }] },
  { type: 'select', key: 'to', label: 'To', default: ',', choices: [{ value: ',', label: 'CSV (comma)' }, { value: 'tab', label: 'TSV (tab)' }, { value: ';', label: 'Semicolon' }, { value: '|', label: 'Pipe' }] },
];

export default function TsvCsvConverter() {
  return <TransformTool options={options} example={'name\tnote\nAli\t"Lahore, PK"\nSara\tsaid "hi"'} transform={(t, v) => ({ output: convertDelimiter(t, str(v.from), str(v.to)) })} filename="converted.csv" mime="text/csv" />;
}
