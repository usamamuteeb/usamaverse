'use client';

import { useState } from 'react';
import { CheckboxField, SelectField } from '@/components/tool-kit/fields';
import { CsvOpTool } from './CsvOpTool';
import { sortTable } from './logic';

export default function CsvSort() {
  const [col, setCol] = useState(0);
  const [mode, setMode] = useState<'text' | 'natural' | 'number'>('natural');
  const [desc, setDesc] = useState(false);
  const [emptyLast, setEmptyLast] = useState(true);
  return (
    <CsvOpTool
      example={'file,size\nreport10.pdf,1200\nreport2.pdf,800\nnotes.txt,\nreport1.pdf,95'}
      filename="sorted.csv"
      controls={(_t, labels) => (
        <div className="form-grid">
          <SelectField label="Sort by column" value={String(Math.min(col, labels.length - 1))} onChange={(v) => setCol(Number(v))} options={labels.map((l, i) => ({ value: String(i), label: l }))} />
          <SelectField label="Compare as" value={mode} onChange={(v) => setMode(v as 'text')} options={[{ value: 'natural', label: 'Natural text (2 before 10)' }, { value: 'text', label: 'Plain text' }, { value: 'number', label: 'Numbers' }]} />
          <CheckboxField label="Descending" checked={desc} onChange={setDesc} />
          <CheckboxField label="Empty values last" checked={emptyLast} onChange={setEmptyLast} />
        </div>
      )}
      run={(t) => ({ output: sortTable(t, Math.min(col, t.columns - 1), { mode, desc, emptyLast }), summary: `${t.rows.length} rows sorted. Ties keep their original order.` })}
    />
  );
}
