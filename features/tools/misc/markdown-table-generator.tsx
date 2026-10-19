'use client';

import { useState } from 'react';
import { Button } from '@/components/tool-kit/actions';
import { SelectField, TextAreaField } from '@/components/tool-kit/fields';
import { GridEditor, textToGrid } from '@/components/tool-kit/GridEditor';
import { OutputPanel } from '@/components/tool-kit/output';
import { gridToMarkdown, type Align } from '@/features/tools/language/logic';

const START = [['Tool', 'Category', 'Local'], ['Word counter', 'Text', 'Yes'], ['QR generator', 'Generators', 'Yes']];

export default function MarkdownTableGenerator() {
  const [grid, setGrid] = useState<string[][]>(START);
  const [align, setAlign] = useState<Align[]>([]);
  const [paste, setPaste] = useState('');
  const cols = grid[0]?.length ?? 0;
  return (
    <div className="tool-grid">
      <div className="tool-col">
        <GridEditor grid={grid} onChange={setGrid} />
        <div className="form-grid">
          {Array.from({ length: cols }, (_, i) => (
            <SelectField key={i} label={`Column ${i + 1} alignment`} value={align[i] ?? 'none'} onChange={(v) => setAlign((a) => { const n = a.slice(); n[i] = v as Align; return n; })} options={[{ value: 'none', label: 'Default' }, { value: 'left', label: 'Left' }, { value: 'center', label: 'Center' }, { value: 'right', label: 'Right' }]} />
          ))}
        </div>
        <TextAreaField label="Or paste rows from a spreadsheet (tab- or comma-separated)" value={paste} onChange={setPaste} rows={4} />
        <div className="actions">
          <Button onClick={() => paste.trim() && setGrid(textToGrid(paste))} disabled={!paste.trim()}>Load pasted rows</Button>
          <Button variant="ghost" onClick={() => { setGrid(START); setAlign([]); setPaste(''); }}>Reset</Button>
        </div>
      </div>
      <div className="tool-col">
        <OutputPanel label="Markdown" value={gridToMarkdown(grid, align)} filename="table.md" mime="text/markdown" />
      </div>
    </div>
  );
}
