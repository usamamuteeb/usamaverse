'use client';

import { useState } from 'react';
import { CheckboxField, SelectField, TextField } from '@/components/tool-kit/fields';
import { CsvOpTool } from './CsvOpTool';
import { filterTable, type FilterOp } from './logic';

const OPS: Array<{ value: FilterOp; label: string }> = [
  { value: 'contains', label: 'contains' }, { value: 'not-contains', label: 'does not contain' }, { value: 'equals', label: 'equals' }, { value: 'not-equals', label: 'does not equal' },
  { value: 'starts', label: 'starts with' }, { value: 'ends', label: 'ends with' }, { value: 'empty', label: 'is empty' }, { value: 'not-empty', label: 'is not empty' },
  { value: 'gt', label: 'is greater than (number)' }, { value: 'lt', label: 'is less than (number)' },
];

export default function CsvFilter() {
  const [col, setCol] = useState(0);
  const [op, setOp] = useState<FilterOp>('contains');
  const [value, setValue] = useState('');
  const [ignoreCase, setIgnoreCase] = useState(true);
  return (
    <CsvOpTool
      example={'name,city,score\nAli,Lahore,91\nSara,Karachi,88\nOmar,Lahore,72'}
      filename="filtered.csv"
      controls={(_t, labels) => (
        <div className="form-grid">
          <SelectField label="Column" value={String(Math.min(col, labels.length - 1))} onChange={(v) => setCol(Number(v))} options={labels.map((l, i) => ({ value: String(i), label: l }))} />
          <SelectField label="Condition" value={op} onChange={(v) => setOp(v as FilterOp)} options={OPS} />
          {op !== 'empty' && op !== 'not-empty' && <TextField label="Value" value={value} onChange={setValue} />}
          <CheckboxField label="Ignore case" checked={ignoreCase} onChange={setIgnoreCase} />
        </div>
      )}
      run={(t) => {
        const r = filterTable(t, Math.min(col, t.columns - 1), op, value, ignoreCase);
        return { output: r.csv, summary: `${r.kept} of ${r.total} rows match.` };
      }}
    />
  );
}
