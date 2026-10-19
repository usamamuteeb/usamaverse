'use client';

import { GeneratorTool } from '@/components/tool-kit/GeneratorTool';
import { str, type OptionDef } from '@/components/tool-kit/options';
import { pins } from './logic';

const options: OptionDef[] = [
  { type: 'number', key: 'length', label: 'Digits (4–12)', default: '6' },
  { type: 'number', key: 'count', label: 'How many (1–100)', default: '1' },
];

export default function PinGenerator() {
  return (
    <GeneratorTool
      options={options}
      outputLabel="PINs"
      generate={(v) => pins(Number(str(v.length)), Number(str(v.count))).join('\n')}
      note={<p className="field-hint">Each digit is chosen uniformly at random. A 4-digit PIN has only 10,000 possibilities, so use longer PINs where you can.</p>}
    />
  );
}
