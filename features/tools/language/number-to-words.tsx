'use client';

import { TransformTool } from '@/components/tool-kit/TransformTool';
import { bool, type OptionDef } from '@/components/tool-kit/options';
import { numberToWords } from './logic';

const options: OptionDef[] = [
  { type: 'checkbox', key: 'ordinal', label: 'Ordinal (first, second, twenty-first…)', default: false },
  { type: 'checkbox', key: 'british', label: 'British style (“one hundred and five”)', default: false },
];

export default function NumberToWords() {
  return (
    <TransformTool
      inputLabel="Numbers (one per line)"
      inputRows={6}
      options={options}
      example={'1234567\n1005\n-3.14\n21'}
      allowFile={false}
      transform={(t, v) => ({
        output: t
          .split(/\r?\n/)
          .map((l, i) => {
            if (!l.trim()) return '';
            try {
              return numberToWords(l, { ordinal: bool(v.ordinal), british: bool(v.british) });
            } catch (e) {
              throw new Error(`Line ${i + 1}: ${e instanceof Error ? e.message : String(e)}`);
            }
          })
          .join('\n'),
      })}
    />
  );
}
