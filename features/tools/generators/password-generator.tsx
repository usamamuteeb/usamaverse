'use client';

import { GeneratorTool } from '@/components/tool-kit/GeneratorTool';
import { bool, str, type OptionDef, type OptionValues } from '@/components/tool-kit/options';
import { entropyBits, generatePassword, passwordPools, strengthLabel, type PasswordOptions } from './logic';

const options: OptionDef[] = [
  { type: 'number', key: 'length', label: 'Length (4–128)', default: '20' },
  { type: 'number', key: 'count', label: 'How many (1–50)', default: '1' },
  { type: 'checkbox', key: 'lower', label: 'Lowercase a–z', default: true },
  { type: 'checkbox', key: 'upper', label: 'Uppercase A–Z', default: true },
  { type: 'checkbox', key: 'digits', label: 'Digits 0–9', default: true },
  { type: 'checkbox', key: 'symbols', label: 'Symbols !@#$…', default: true },
  { type: 'checkbox', key: 'excludeAmbiguous', label: 'Avoid look-alike characters (I l 1 O 0 o)', default: false },
];

function opts(v: OptionValues): PasswordOptions {
  return { length: Number(str(v.length)), lower: bool(v.lower), upper: bool(v.upper), digits: bool(v.digits), symbols: bool(v.symbols), excludeAmbiguous: bool(v.excludeAmbiguous) };
}

export default function PasswordGenerator() {
  return (
    <GeneratorTool
      options={options}
      outputLabel="Password"
      generate={(v) => {
        const count = Number(str(v.count));
        if (!Number.isInteger(count) || count < 1 || count > 50) throw new Error('Generate between 1 and 50 passwords.');
        return Array.from({ length: count }, () => generatePassword(opts(v))).join('\n');
      }}
      describe={(v) => {
        const o = opts(v);
        const pool = passwordPools(o).join('').length;
        const bits = entropyBits(o.length, pool);
        return (
          <p className="summary">
            Strength estimate: <strong>{strengthLabel(bits)}</strong> — about {Math.round(bits)} bits of entropy ({pool} possible characters × {o.length}). Generated on this device with crypto.getRandomValues and not stored.
          </p>
        );
      }}
    />
  );
}
