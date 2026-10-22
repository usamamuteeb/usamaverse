'use client';

import { useState } from 'react';
import { Button } from '@/components/tool-kit/actions';
import { SelectField, Status, TextAreaField, TextField } from '@/components/tool-kit/fields';
import { printHtml } from '@/lib/tools/shared/print';
import { labelPrintContent, type LabelOptions } from './labels';

const DEFAULT: LabelOptions = { paper: 'a4', width: 63.5, height: 38.1, marginX: 7, marginY: 11, gapX: 2.5, gapY: 2, repeat: 1 };
export default function LabelPrinter() {
  const [items, setItems] = useState('UsamaVerse\nTools that stay on your device');
  const [o, setO] = useState<LabelOptions>(DEFAULT);
  let error = '';
  const set = (key: keyof LabelOptions) => (value: string) => setO((old) => ({ ...old, [key]: key === 'paper' ? value : Number(value) }));
  let result: ReturnType<typeof labelPrintContent> | null = null;
  try { result = labelPrintContent(items.split(/\r?\n/), o); } catch (e) { error = e instanceof Error ? e.message : String(e); }
  return <div className="tool-grid">
    <div className="tool-col">
      <TextAreaField label="Label text — one label per line" value={items} onChange={setItems} rows={5} mono={false} />
      <div className="field-row"><SelectField label="Paper" value={o.paper} onChange={set('paper')} options={[{ value: 'a4', label: 'A4' }, { value: 'letter', label: 'US Letter' }]} /><TextField label="Copies of each line" value={String(o.repeat)} onChange={set('repeat')} type="number" min={1} max={20} /></div>
      <div className="field-row"><TextField label="Label width (mm)" value={String(o.width)} onChange={set('width')} type="number" min={10} step="0.1" /><TextField label="Label height (mm)" value={String(o.height)} onChange={set('height')} type="number" min={8} step="0.1" /></div>
      <div className="field-row"><TextField label="Left/right margin (mm)" value={String(o.marginX)} onChange={set('marginX')} type="number" min={0} step="0.1" /><TextField label="Top/bottom margin (mm)" value={String(o.marginY)} onChange={set('marginY')} type="number" min={0} step="0.1" /></div>
      <div className="field-row"><TextField label="Horizontal gap (mm)" value={String(o.gapX)} onChange={set('gapX')} type="number" min={0} step="0.1" /><TextField label="Vertical gap (mm)" value={String(o.gapY)} onChange={set('gapY')} type="number" min={0} step="0.1" /></div>
      <div className="actions"><Button variant="primary" disabled={!result} onClick={() => result && printHtml(result.html, result.css, 'Printable labels', o.paper, '0')}>Print / Save as PDF</Button><Button variant="ghost" onClick={() => setO(DEFAULT)}>Reset dimensions</Button></div>
      <p className="field-hint">Use print scale 100% and disable browser headers/footers for physical label stock. Print a plain-paper test sheet first.</p>
    </div>
    <div className="tool-col">
      {error && <Status tone="error">{error}</Status>}
      {result && <><p className="summary">{result.count} labels on {result.pages} page{result.pages === 1 ? '' : 's'}.</p><div className="label-preview">{items.split(/\r?\n/).filter(Boolean).slice(0, 12).map((line, i) => <div key={i}>{line}</div>)}</div></>}
    </div>
  </div>;
}
