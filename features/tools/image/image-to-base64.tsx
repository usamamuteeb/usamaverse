'use client';

import { useState } from 'react';
import { CopyButton } from '@/components/tool-kit/actions';
import { SelectField, Status } from '@/components/tool-kit/fields';
import { FileDrop } from '@/components/tool-kit/files';
import { OutputPanel } from '@/components/tool-kit/output';
import { formatBytes } from '@/lib/format';
import { bytesToBase64 } from '@/features/tools/developer/logic';
import { detectSignature } from '@/features/tools/files/logic';

const MAX = 5 * 1024 * 1024;

export default function ImageToBase64() {
  const [uri, setUri] = useState('');
  const [mime, setMime] = useState('');
  const [info, setInfo] = useState('');
  const [fmt, setFmt] = useState<'uri' | 'raw' | 'img' | 'css'>('uri');
  const [error, setError] = useState<string | null>(null);
  const raw = uri.split(',')[1] ?? '';
  const out = { uri, raw, img: `<img src="${uri}" alt="">`, css: `background-image: url("${uri}");` }[fmt];
  return (
    <div className="tool-grid">
      <div className="tool-col">
        <FileDrop
          accept="image/*"
          label="Choose image"
          onFiles={async ([f]) => {
            setError(null);
            setUri('');
            if (f.size > MAX) return setError(`Images up to ${formatBytes(MAX)}. Large data URIs slow pages down; link to a file instead.`);
            const bytes = new Uint8Array(await f.arrayBuffer());
            const sig = detectSignature(bytes.subarray(0, 32));
            const isSvg = !sig && /<svg[\s>]/i.test(new TextDecoder().decode(bytes.subarray(0, 2048)));
            const type = sig?.mime.startsWith('image/') ? sig.mime : isSvg ? 'image/svg+xml' : null;
            if (!type) return setError('This file is not a recognised image.');
            setMime(type);
            setUri(`data:${type};base64,${bytesToBase64(bytes)}`);
            setInfo(`${f.name}: ${formatBytes(f.size)} → ${formatBytes(Math.ceil(bytes.length / 3) * 4)} as Base64`);
          }}
        />
        <SelectField label="Output" value={fmt} onChange={(v) => setFmt(v as 'uri')} options={[{ value: 'uri', label: 'Data URI' }, { value: 'raw', label: 'Raw Base64 only' }, { value: 'img', label: 'HTML <img>' }, { value: 'css', label: 'CSS background-image' }]} />
      </div>
      <div className="tool-col">
        {error && <Status tone="error">{error}</Status>}
        {uri && (
          <>
            <p className="summary">{info} ({mime})</p>
            <OutputPanel label="Result" value={out} rows={8} extraActions={<CopyButton text={raw} label="Copy raw Base64" />} />
          </>
        )}
      </div>
    </div>
  );
}
