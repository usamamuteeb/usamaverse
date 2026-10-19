'use client';

import { useMemo, useState } from 'react';
import { Button, DownloadBlobButton } from '@/components/tool-kit/actions';
import { Status, TextAreaField } from '@/components/tool-kit/fields';
import { useObjectUrl } from '@/components/tool-kit/files';
import { ResultRows } from '@/components/tool-kit/output';
import { formatBytes } from '@/lib/format';
import { base64ToBytes } from '@/features/tools/developer/logic';
import { detectSignature } from '@/features/tools/files/logic';

export default function Base64ToImage() {
  const [input, setInput] = useState('');
  const r = useMemo(() => {
    if (!input.trim()) return null;
    try {
      const declared = input.trim().match(/^data:([^;,]+)/i)?.[1]?.toLowerCase();
      const bytes = base64ToBytes(input.trim().replace(/^data:[^,]*,/i, ''));
      const sig = detectSignature(bytes.subarray(0, 32));
      const svg = !sig && /<svg[\s>]/i.test(new TextDecoder().decode(bytes.subarray(0, 2048)));
      const mime = sig?.mime.startsWith('image/') ? sig.mime : svg ? 'image/svg+xml' : null;
      if (!mime) throw new Error(sig ? `This decodes to ${sig.label}, not an image.` : 'The decoded data is not a recognised image.');
      const ext = mime === 'image/svg+xml' ? 'svg' : sig!.extensions[0];
      return { blob: new Blob([bytes as BlobPart], { type: mime }), mime, ext, size: bytes.length, mismatch: declared && declared !== mime, err: null as string | null };
    } catch (e) {
      return { err: e instanceof Error ? e.message : String(e) } as { err: string };
    }
  }, [input]);
  const blob = r && !r.err && 'blob' in r ? r.blob : null;
  const url = useObjectUrl(blob);
  return (
    <div className="tool-grid">
      <div className="tool-col">
        <TextAreaField label="Base64 or data URI" value={input} onChange={setInput} rows={10} placeholder="data:image/png;base64,iVBORw0KGgo…" />
        <Button variant="ghost" onClick={() => setInput('')}>Reset</Button>
      </div>
      <div className="tool-col">
        {r?.err && <Status tone="error">{r.err}</Status>}
        {r && !r.err && 'mime' in r && url && (
          <>
            <div className="canvas-wrap">
              {/* SVG is shown through <img>, where scripts never run. */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={url} alt="Decoded image preview" />
            </div>
            <ResultRows rows={[{ label: 'Detected type', value: r.mime }, { label: 'Size', value: formatBytes(r.size) }]} />
            {r.mismatch && <Status tone="warn">The data URI’s declared type doesn’t match the actual content; the detected type is used.</Status>}
            <DownloadBlobButton blob={blob} filename={`image.${r.ext}`} label={`Download .${r.ext}`} />
          </>
        )}
      </div>
    </div>
  );
}
