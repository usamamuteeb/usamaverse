'use client';

import { FormTool, type FieldDef, type FormResult, type FormValues } from '@/components/tool-kit/FormTool';
import { bigToBase, parseBigInBase } from './logic';

const baseChoices = [
  { value: '2', label: 'Binary (2)' },
  { value: '8', label: 'Octal (8)' },
  { value: '10', label: 'Decimal (10)' },
  { value: '16', label: 'Hexadecimal (16)' },
  ...Array.from({ length: 35 }, (_, i) => i + 2)
    .filter((b) => ![2, 8, 10, 16].includes(b))
    .map((b) => ({ value: String(b), label: `Base ${b}` })),
];

const fields: FieldDef[] = [
  { type: 'text', key: 'value', label: 'Number', default: '255', placeholder: 'ff, 1010, 0x1F…' },
  { type: 'select', key: 'from', label: 'Input base', default: '10', choices: baseChoices },
  { type: 'select', key: 'custom', label: 'Also show base', default: '36', choices: baseChoices },
  { type: 'checkbox', key: 'upper', label: 'Uppercase letters', default: true },
];

function compute(v: FormValues): FormResult | null {
  if (!String(v.value).trim()) return null;
  const n = parseBigInBase(String(v.value), Number(v.from));
  const fmt = (b: number) => {
    const s = bigToBase(n, b);
    return v.upper ? s.toUpperCase() : s;
  };
  const group = (s: string, size: number) => s.replace(/^-/, '').replace(new RegExp(`\\B(?=([0-9A-Za-z]{${size}})+$)`, 'g'), ' ');
  return {
    rows: [
      { label: 'Decimal', value: fmt(10), emphasis: true },
      { label: 'Hexadecimal', value: fmt(16) },
      { label: 'Octal', value: fmt(8) },
      { label: 'Binary', value: (n < BigInt(0) ? '-' : '') + group(fmt(2), 4) },
      { label: `Base ${v.custom}`, value: fmt(Number(v.custom)) },
      { label: 'Bits needed', value: String((n < BigInt(0) ? -n : n).toString(2).length) },
    ],
  };
}

export default function NumberBaseConverter() {
  return <FormTool fields={fields} compute={compute} />;
}
