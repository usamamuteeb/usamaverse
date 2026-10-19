'use client';

import { TransformTool } from '@/components/tool-kit/TransformTool';
import { decodeJwt } from './logic';

const EXAMPLE =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkV4YW1wbGUgVXNlciIsImlhdCI6MTcwMDAwMDAwMCwiZXhwIjoxNzAwMDAzNjAwfQ.c2lnbmF0dXJlLW5vdC12ZXJpZmllZA';

export default function JwtDecoder() {
  return (
    <TransformTool
      inputLabel="JWT"
      inputRows={6}
      placeholder="eyJhbGciOi…"
      example={EXAMPLE}
      allowFile={false}
      transform={(t) => {
        const d = decodeJwt(t);
        const times = d.times.map((x) => `${x.claim}: ${x.value} → ${x.iso} (${x.note})`).join('\n');
        return {
          output: `HEADER\n${JSON.stringify(d.header, null, 2)}\n\nPAYLOAD\n${JSON.stringify(d.payload, null, 2)}${times ? `\n\nTIME CLAIMS (UTC)\n${times}` : ''}`,
          warning: 'Signature NOT verified. Anyone can create a token with these contents; do not trust it without verifying the signature on your server.',
          summary: d.hasSignature ? 'Decoded. A signature segment is present but was not checked.' : 'Decoded. This token has no signature (alg “none”?).',
        };
      }}
    />
  );
}
