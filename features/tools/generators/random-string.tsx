'use client';

import { GeneratorTool } from '@/components/tool-kit/GeneratorTool';
import { str, type OptionDef } from '@/components/tool-kit/options';
import { randomStrings } from './logic';

const options: OptionDef[] = [
  { type: 'number', key: 'length', label: 'Length (1–1,024)', default: '32' },
  { type: 'number', key: 'count', label: 'How many (1–500)', default: '1' },
  {
    type: 'select',
    key: 'charset',
    label: 'Characters',
    default: 'alnum',
    choices: [
      { value: 'alnum', label: 'Letters and digits (A–Z a–z 0–9)' },
      { value: 'alpha', label: 'Letters only' },
      { value: 'lower', label: 'Lowercase letters and digits' },
      { value: 'hex', label: 'Hexadecimal (0–9 a–f)' },
      { value: 'digits', label: 'Digits only' },
      { value: 'base64url', label: 'URL-safe (A–Z a–z 0–9 - _)' },
      { value: 'custom', label: 'Custom…' },
    ],
  },
  { type: 'text', key: 'custom', label: 'Custom characters (when “Custom” is selected)', default: '', placeholder: 'abc123!?' },
];

export default function RandomString() {
  return <GeneratorTool options={options} outputLabel="Random strings" filename="random-strings.txt" generate={(v) => randomStrings({ length: Number(str(v.length)), count: Number(str(v.count)), charset: str(v.charset), custom: str(v.custom) }).join('\n')} />;
}
