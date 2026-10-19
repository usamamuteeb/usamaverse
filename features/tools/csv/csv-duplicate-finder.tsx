'use client';

import { useState } from 'react';
import { CheckboxField, SelectField } from '@/components/tool-kit/fields';
import { CsvOpTool } from './CsvOpTool';
import { duplicates } from './logic';

export default function CsvDuplicateFinder() {
  const [keys, setKeys] = useState<number[]>([]);
  const [ignoreCase, setIgnoreCase] = useState(true);
  const [trim, setTrim] = useState(true);
  const [show, setShow] = useState<'dedupe' | 'dupes'>('dedupe');
  return (
    <CsvOpTool
      example={'email,name\nali@example.com,Ali\nSARA@example.com,Sara\nali@example.com ,Ali K\nomar@example.com,Omar'}
      filename="deduplicated.csv"
      controls={(_t, labels) => (
        <>
          <fieldset className="options">
            <legend className="field-label">Compare rows by (none selected = whole row)</legend>
            {labels.map((l, i) => (
              <CheckboxField key={i} label={l} checked={keys.includes(i)} onChange={(on) => setKeys((k) => (on ? [...k, i] : k.filter((x) => x !== i)))} />
            ))}
          </fieldset>
          <CheckboxField label="Ignore upper/lower case" checked={ignoreCase} onChange={setIgnoreCase} />
          <CheckboxField label="Ignore spaces at the ends of values" checked={trim} onChange={setTrim} />
          <SelectField label="Output" value={show} onChange={(v) => setShow(v as 'dedupe')} options={[{ value: 'dedupe', label: 'Table without duplicates (keeps first)' }, { value: 'dupes', label: 'Only the duplicated rows' }]} />
        </>
      )}
      run={(t) => {
        const r = duplicates(t, keys.filter((k) => k < t.columns), { ignoreCase, trim });
        return { output: show === 'dedupe' ? r.deduped : r.onlyDuplicates, summary: `${r.duplicateRows} duplicate row${r.duplicateRows === 1 ? '' : 's'} in ${r.dupGroups.length} group${r.dupGroups.length === 1 ? '' : 's'} (of ${t.rows.length} rows).` };
      }}
    />
  );
}
