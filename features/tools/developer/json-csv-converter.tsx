'use client';

import { TransformTool } from '@/components/tool-kit/TransformTool';
import { bool, str, type OptionDef } from '@/components/tool-kit/options';
import { csvToJson, jsonToCsv } from './logic';

const delimiterChoices = [
  { value: 'auto', label: 'Detect automatically' },
  { value: ',', label: 'Comma (,)' },
  { value: ';', label: 'Semicolon (;)' },
  { value: 'tab', label: 'Tab' },
  { value: '|', label: 'Pipe (|)' },
];

const options: OptionDef[] = [
  { type: 'select', key: 'direction', label: 'Direction', default: 'json-csv', choices: [{ value: 'json-csv', label: 'JSON → CSV' }, { value: 'csv-json', label: 'CSV → JSON' }] },
  { type: 'select', key: 'delimiter', label: 'CSV delimiter', default: 'auto', choices: delimiterChoices, hint: 'For JSON → CSV, “detect” writes commas.' },
  { type: 'checkbox', key: 'header', label: 'CSV has a header row (CSV → JSON)', default: true },
];

export default function JsonCsvConverter() {
  return (
    <TransformTool
      options={options}
      placeholder="Paste a JSON array, or CSV text…"
      example={'[{"name":"Ali, Khan","city":"Lahore","note":"said \\"hi\\""},{"name":"Sara","city":"Karachi"}]'}
      transform={(t, v) => {
        const d = str(v.delimiter);
        if (str(v.direction) === 'json-csv') {
          const r = jsonToCsv(t, d === 'auto' ? ',' : d === 'tab' ? '\t' : d);
          return { output: r.output, summary: `${r.rows.toLocaleString()} rows × ${r.columns} columns.` };
        }
        const r = csvToJson(t, { delimiter: d, header: bool(v.header) });
        return { output: r.output, summary: `${r.rows.toLocaleString()} records.` };
      }}
      filename="converted.txt"
    />
  );
}
