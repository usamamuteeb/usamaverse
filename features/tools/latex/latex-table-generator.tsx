'use client';

import { useMemo, useState } from 'react';
import { Button } from '@/components/tool-kit/actions';
import { CheckboxField, SelectField, TextAreaField, TextField } from '@/components/tool-kit/fields';
import { GridEditor, textToGrid } from '@/components/tool-kit/GridEditor';
import { OutputPanel } from '@/components/tool-kit/output';
import { gridToLatex, type TableOptions } from './latex-tools';

const START = [
  ['Method', 'Accuracy', 'Time (s)'],
  ['Baseline', '81.2%', '12'],
  ['Ours', '89.7%', '9'],
];

export default function LatexTableGenerator() {
  const [grid, setGrid] = useState<string[][]>(START);
  const [paste, setPaste] = useState('');
  const [style, setStyle] = useState<TableOptions['style']>('booktabs');
  const [align, setAlign] = useState('auto');
  const [header, setHeader] = useState(true);
  const [bold, setBold] = useState(true);
  const [float, setFloat] = useState(true);
  const [caption, setCaption] = useState('Results on the test set');
  const [label, setLabel] = useState('tab:results');

  const cols = grid[0]?.length ?? 0;
  const aligns = useMemo(() => {
    if (align !== 'auto') return Array(cols).fill(align);
    // numbers right-aligned, text left-aligned
    return Array.from({ length: cols }, (_, c) => (grid.slice(header ? 1 : 0).every((r) => !r[c]?.trim() || /^[-+]?[\d.,]+\s*(%|s|ms|kg|m)?$/.test(r[c].trim())) ? 'r' : 'l'));
  }, [align, cols, grid, header]);
  const latex = useMemo(() => gridToLatex(grid, { header, aligns, style, caption, label, float, boldHeader: bold && header }), [grid, header, aligns, style, caption, label, float, bold]);

  return (
    <div className="tool-grid">
      <div className="tool-col">
        <GridEditor grid={grid} onChange={setGrid} headerRow={header} />
        <TextAreaField label="…or paste from Excel / CSV" hint="Tab- or comma-separated rows replace the grid." value={paste} onChange={setPaste} rows={4} />
        <div className="actions">
          <Button onClick={() => paste.trim() && setGrid(textToGrid(paste))} disabled={!paste.trim()}>
            Use pasted data
          </Button>
          <Button variant="ghost" onClick={() => setGrid([['', ''], ['', '']])}>
            Clear grid
          </Button>
        </div>
        <fieldset className="options">
          <legend>Table options</legend>
          <SelectField label="Lines" value={style} onChange={(v) => setStyle(v as TableOptions['style'])} options={[{ value: 'booktabs', label: 'booktabs (publication style)' }, { value: 'grid', label: 'Full grid' }, { value: 'plain', label: 'No lines' }]} />
          <SelectField label="Alignment" value={align} onChange={setAlign} options={[{ value: 'auto', label: 'Auto (numbers right)' }, { value: 'l', label: 'All left' }, { value: 'c', label: 'All centred' }, { value: 'r', label: 'All right' }]} />
          <CheckboxField label="First row is a header" checked={header} onChange={setHeader} />
          <CheckboxField label="Bold header" checked={bold} onChange={setBold} />
          <CheckboxField label="Wrap in a floating table" checked={float} onChange={setFloat} />
          {float && <TextField label="Caption" value={caption} onChange={setCaption} />}
          {float && <TextField label="Label" value={label} onChange={setLabel} />}
        </fieldset>
      </div>
      <div className="tool-col">
        <OutputPanel label="LaTeX table" value={latex} filename="table.tex" mime="application/x-tex" rows={18} />
        <p className="field-hint">Cell text is escaped (&amp;, %, $, # and _ are safe). Reference the table with \ref{'{'}{label || 'tab:…'}{'}'}.</p>
      </div>
    </div>
  );
}
