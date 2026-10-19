'use client';

import { useState } from 'react';
import { CopyButton } from '@/components/tool-kit/actions';
import { SelectField, Status, TextField } from '@/components/tool-kit/fields';
import { cssVariables, palette, type Scheme } from './design';
import { parseColor, toHex } from './logic';
import { Swatches } from './Swatches';

const SCHEMES: Array<{ value: Scheme; label: string }> = [
  { value: 'complementary', label: 'Complementary' },
  { value: 'analogous', label: 'Analogous' },
  { value: 'triadic', label: 'Triadic' },
  { value: 'split', label: 'Split-complementary' },
  { value: 'tetradic', label: 'Tetradic (square)' },
  { value: 'monochromatic', label: 'Monochromatic' },
  { value: 'shades', label: 'Tints & shades (9 steps)' },
];

export default function PaletteGenerator() {
  const [base, setBase] = useState('#C6283D');
  const [scheme, setScheme] = useState<Scheme>('analogous');
  let colors: string[] = [];
  let error: string | null = null;
  try {
    colors = palette(base, scheme);
  } catch (e) {
    error = e instanceof Error ? e.message : String(e);
  }
  const c = parseColor(base);
  const vars = colors.length ? cssVariables(colors) : '';
  return (
    <div className="tool-grid">
      <div className="tool-col">
        <div className="color-pair">
          <TextField label="Base color" value={base} onChange={setBase} />
          <input type="color" className="color-input" aria-label="Base color picker" value={c ? toHex({ ...c, a: 1 }) : '#000000'} onChange={(e) => setBase(e.target.value)} />
        </div>
        <SelectField label="Harmony" value={scheme} onChange={(v) => setScheme(v as Scheme)} options={SCHEMES} />
        <p className="field-hint">Harmonies rotate the hue on the HSL color wheel. They’re a starting point; always check contrast for text.</p>
      </div>
      <div className="tool-col">
        {error && <Status tone="error">{error}</Status>}
        {colors.length > 0 && (
          <>
            <Swatches colors={colors} />
            <div className="output-head">
              <span className="field-label">CSS variables</span>
              <span className="actions">
                <CopyButton text={vars} />
                <CopyButton text={colors.join(', ')} label="Copy HEX list" />
              </span>
            </div>
            <pre className="code-block">{vars}</pre>
          </>
        )}
      </div>
    </div>
  );
}
