'use client';

import { useState } from 'react';
import { Button } from '@/components/tool-kit/actions';
import { CheckboxField, Status, TextAreaField, TextField } from '@/components/tool-kit/fields';
import { GridEditor, textToGrid } from '@/components/tool-kit/GridEditor';
import { OutputPanel } from '@/components/tool-kit/output';
import { gridToHtml } from '@/features/tools/language/logic';

const START = [['Name', 'City'], ['Ali', 'Lahore'], ['Sara', 'Karachi']];

export default function HtmlTableGenerator() {
  const [grid, setGrid] = useState<string[][]>(START);
  const [header, setHeader] = useState(true);
  const [caption, setCaption] = useState('');
  const [cls, setCls] = useState('');
  const [paste, setPaste] = useState('');
  let html = '';
  let error: string | null = null;
  try {
    html = gridToHtml(grid, { header, caption, className: cls });
  } catch (e) {
    error = e instanceof Error ? e.message : String(e);
  }
  return (
    <div className="tool-grid">
      <div className="tool-col">
        <GridEditor grid={grid} onChange={setGrid} />
        <CheckboxField label="First row is a header" checked={header} onChange={setHeader} />
        <TextField label="Caption (recommended for accessibility)" value={caption} onChange={setCaption} />
        <TextField label="CSS class (optional)" value={cls} onChange={setCls} />
        <TextAreaField label="Or paste rows (tab- or comma-separated)" value={paste} onChange={setPaste} rows={4} />
        <div className="actions">
          <Button onClick={() => paste.trim() && setGrid(textToGrid(paste))} disabled={!paste.trim()}>Load pasted rows</Button>
          <Button variant="ghost" onClick={() => { setGrid(START); setCaption(''); setCls(''); setPaste(''); }}>Reset</Button>
        </div>
      </div>
      <div className="tool-col">
        {error && <Status tone="error">{error}</Status>}
        <OutputPanel label="HTML (all cell text is escaped)" value={html} filename="table.html" mime="text/html" rows={14} />
      </div>
    </div>
  );
}
