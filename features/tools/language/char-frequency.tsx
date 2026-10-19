'use client';

import { StatsTool, type Stat } from '@/components/tool-kit/StatsTool';
import { bool, type OptionDef, type OptionValues } from '@/components/tool-kit/options';
import { charFrequency, graphemes } from '@/features/tools/text/logic';

const options: OptionDef[] = [
  { type: 'checkbox', key: 'ignoreCase', label: 'Ignore case (A = a)', default: true },
  { type: 'checkbox', key: 'ignoreWhitespace', label: 'Ignore spaces and line breaks', default: true },
];

const opts = (v: OptionValues) => ({ ignoreCase: bool(v.ignoreCase), ignoreWhitespace: bool(v.ignoreWhitespace) });

function compute(input: string, v: OptionValues): Stat[] {
  const f = charFrequency(input, opts(v));
  return [
    { label: 'Characters counted', value: f.reduce((n, x) => n + x.count, 0).toLocaleString('en-US') },
    { label: 'Distinct characters', value: f.length.toLocaleString('en-US') },
    { label: 'Total characters', value: graphemes(input).length.toLocaleString('en-US') },
  ];
}

const show = (c: string) => (c === ' ' ? '␠ (space)' : c === '\n' ? '↵ (line break)' : c === '\t' ? '⇥ (tab)' : c);

function Table(input: string, v: OptionValues) {
  const f = charFrequency(input, opts(v)).slice(0, 300);
  if (f.length === 0) return null;
  return (
    <div className="table-scroll">
      <table className="data-table">
        <caption>Frequency (top {f.length})</caption>
        <thead>
          <tr>
            <th scope="col">Character</th>
            <th scope="col">Count</th>
            <th scope="col">Share</th>
            <th scope="col">Code points</th>
          </tr>
        </thead>
        <tbody>
          {f.map((x) => (
            <tr key={x.char}>
              <td className="char-cell">{show(x.char)}</td>
              <td>{x.count.toLocaleString('en-US')}</td>
              <td>
                <span className="bar" style={{ width: `${Math.max(2, x.percent)}%` }} aria-hidden="true" /> {x.percent.toFixed(1)}%
              </td>
              <td className="mono muted">{Array.from(x.char, (c) => `U+${c.codePointAt(0)!.toString(16).toUpperCase().padStart(4, '0')}`).join(' ')}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function CharFrequency() {
  return <StatsTool options={options} compute={compute} renderExtra={Table} example="Mississippi 🌊🌊 café" />;
}
