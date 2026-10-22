'use client';

import { useState } from 'react';
import { SelectField, TextAreaField } from '@/components/tool-kit/fields';
import { OutputPanel } from '@/components/tool-kit/output';
import { LAYOUTS, QWERTY_ROWS, remapPhysicalLetters, type LayoutName } from './keyboard-layout';

const choices = Object.entries(LAYOUTS).map(([value, layout]) => ({ value, label: layout.name }));

export default function KeyboardLayoutHelper() {
  const [from, setFrom] = useState<LayoutName>('qwerty');
  const [to, setTo] = useState<LayoutName>('dvorak');
  const [sample, setSample] = useState('The quick brown fox jumps over the lazy dog.');
  const result = remapPhysicalLetters(sample, from, to);
  return <div className="tool-grid">
    <div className="tool-col">
      <div className="field-row">
        <SelectField label="Typed on" value={from} onChange={(v) => setFrom(v as LayoutName)} options={choices} />
        <SelectField label="Same keys on" value={to} onChange={(v) => setTo(v as LayoutName)} options={choices} />
      </div>
      <TextAreaField label="Sample text" value={sample} onChange={setSample} rows={4} />
      <p className="field-hint">This models the US letter-key positions. It does not emulate Shift, dead keys, accents, punctuation keys or operating-system shortcuts.</p>
      <div className="keyboard-preview" aria-label={`${LAYOUTS[to].name} letter-key positions`}>
        {QWERTY_ROWS.map((row, r) => <div className="keyboard-row" key={r}>
          {Array.from(row, (key, i) => <span className="keyboard-key" key={key} title={`Physical ${key.toUpperCase()}`}>{LAYOUTS[to].rows[r][i].toUpperCase()}</span>)}
        </div>)}
      </div>
    </div>
    <div className="tool-col"><OutputPanel label="What the same keys would type" value={result} rows={5} /></div>
  </div>;
}
