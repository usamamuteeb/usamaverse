'use client';

import { TransformTool } from '@/components/tool-kit/TransformTool';
import { fromRoman, toRoman } from '@/features/tools/math/logic';
import { splitLines } from '@/features/tools/text/logic';

function convertLine(line: string): string {
  const t = line.trim();
  if (!t) return '';
  if (/^\d[\d,]*$/.test(t)) return toRoman(Number(t.replace(/,/g, '')));
  return String(fromRoman(t));
}

export default function RomanNumerals() {
  return (
    <TransformTool
      inputLabel="Numbers or Roman numerals (one per line)"
      inputRows={6}
      example={'2026\nMCMXCIV\n49\nxiv'}
      allowFile={false}
      transform={(t) => ({
        output: splitLines(t)
          .map((l, i) => {
            try {
              return convertLine(l);
            } catch (e) {
              throw new Error(`Line ${i + 1}: ${e instanceof Error ? e.message : String(e)}`);
            }
          })
          .join('\n'),
      })}
    />
  );
}
