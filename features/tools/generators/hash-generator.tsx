'use client';

import { TransformTool } from '@/components/tool-kit/TransformTool';
import { str, type OptionDef } from '@/components/tool-kit/options';
import { hashText, type HashAlg } from './logic';

const options: OptionDef[] = [
  {
    type: 'select',
    key: 'alg',
    label: 'Algorithm',
    default: 'SHA-256',
    choices: [
      { value: 'SHA-256', label: 'SHA-256' },
      { value: 'SHA-384', label: 'SHA-384' },
      { value: 'SHA-512', label: 'SHA-512' },
      { value: 'SHA-1', label: 'SHA-1 (legacy — not collision resistant)' },
    ],
  },
  { type: 'select', key: 'format', label: 'Output', default: 'hex', choices: [{ value: 'hex', label: 'Hexadecimal' }, { value: 'base64', label: 'Base64' }] },
];

export default function HashGenerator() {
  return (
    <TransformTool
      inputLabel="Text (hashed as UTF-8)"
      options={options}
      allowEmpty
      example="hello world"
      transform={async (t, v) => {
        const alg = str(v.alg) as HashAlg;
        const output = await hashText(t, alg, str(v.format) as 'hex');
        return { output, warning: alg === 'SHA-1' ? 'SHA-1 is broken for collision resistance. Use it only to match a legacy system.' : undefined, summary: t === '' ? `${alg} of empty input.` : undefined };
      }}
    />
  );
}
