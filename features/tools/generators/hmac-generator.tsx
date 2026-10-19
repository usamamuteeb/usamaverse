'use client';

import { TransformTool } from '@/components/tool-kit/TransformTool';
import { str, type OptionDef } from '@/components/tool-kit/options';
import { decodeKey, hmac, toBase64, toHex, type HmacAlg } from './security';

const options: OptionDef[] = [
  { type: 'text', key: 'key', label: 'Secret key', default: '', placeholder: 'Your secret (stays in this browser)' },
  { type: 'select', key: 'keyFmt', label: 'Key format', default: 'text', choices: [{ value: 'text', label: 'Text (UTF-8)' }, { value: 'hex', label: 'Hex' }, { value: 'base64', label: 'Base64 / Base64URL' }] },
  { type: 'select', key: 'alg', label: 'Algorithm', default: 'SHA-256', choices: [{ value: 'SHA-256', label: 'HMAC-SHA256' }, { value: 'SHA-384', label: 'HMAC-SHA384' }, { value: 'SHA-512', label: 'HMAC-SHA512' }, { value: 'SHA-1', label: 'HMAC-SHA1 (legacy)' }] },
  { type: 'select', key: 'out', label: 'Output', default: 'hex', choices: [{ value: 'hex', label: 'Hex' }, { value: 'base64', label: 'Base64' }] },
];

export default function HmacGenerator() {
  return (
    <TransformTool
      inputLabel="Message"
      options={options}
      allowEmpty
      allowFile={false}
      transform={async (t, v) => {
        if (!str(v.key)) return { output: '', summary: 'Enter a secret key to compute the HMAC.' };
        const mac = await hmac(t, decodeKey(str(v.key), str(v.keyFmt) as 'text'), str(v.alg) as HmacAlg);
        return { output: str(v.out) === 'base64' ? toBase64(mac) : toHex(mac) };
      }}
    />
  );
}
