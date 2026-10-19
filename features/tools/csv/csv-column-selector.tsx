'use client';

import { useState } from 'react';
import { Button } from '@/components/tool-kit/actions';
import { CsvOpTool } from './CsvOpTool';
import { selectColumns } from './logic';

const EXAMPLE = 'id,name,email,city,score\n1,Ali,ali@example.com,Lahore,91\n2,Sara,sara@example.com,Karachi,88';

export default function CsvColumnSelector() {
  const [order, setOrder] = useState<number[] | null>(null);
  return (
    <CsvOpTool
      example={EXAMPLE}
      controls={(t, labels) => {
        const cur = (order ?? labels.map((_, i) => i)).filter((i) => i < t.columns);
        const toggle = (i: number) => setOrder(cur.includes(i) ? cur.filter((x) => x !== i) : [...cur, i]);
        const move = (pos: number, d: -1 | 1) => {
          const a = cur.slice();
          const j = pos + d;
          if (j < 0 || j >= a.length) return;
          [a[pos], a[j]] = [a[j], a[pos]];
          setOrder(a);
        };
        return (
          <fieldset className="options">
            <legend className="field-label">Columns to keep (in output order)</legend>
            <ol className="file-list">
              {cur.map((i, pos) => (
                <li key={i}>
                  <span className="file-name">{labels[i]}</span>
                  <span className="actions tight">
                    <Button variant="ghost" ariaLabel={`Move ${labels[i]} up`} disabled={pos === 0} onClick={() => move(pos, -1)}>↑</Button>
                    <Button variant="ghost" ariaLabel={`Move ${labels[i]} down`} disabled={pos === cur.length - 1} onClick={() => move(pos, 1)}>↓</Button>
                    <Button variant="ghost" ariaLabel={`Remove ${labels[i]}`} onClick={() => toggle(i)}>✕</Button>
                  </span>
                </li>
              ))}
            </ol>
            {labels.some((_, i) => !cur.includes(i)) && (
              <div className="actions">
                {labels.map((l, i) => !cur.includes(i) && <Button key={i} variant="ghost" onClick={() => toggle(i)}>+ {l}</Button>)}
              </div>
            )}
            <Button variant="ghost" onClick={() => setOrder(null)}>All columns, original order</Button>
          </fieldset>
        );
      }}
      run={(t) => {
        const cur = (order ?? Array.from({ length: t.columns }, (_, i) => i)).filter((i) => i < t.columns);
        return { output: selectColumns(t, cur), summary: `${cur.length} of ${t.columns} columns, ${t.rows.length} rows.` };
      }}
    />
  );
}
