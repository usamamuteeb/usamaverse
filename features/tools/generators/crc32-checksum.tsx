'use client';

import { useState } from 'react';
import { TransformTool } from '@/components/tool-kit/TransformTool';
import { FileDrop } from '@/components/tool-kit/files';
import { ResultRows } from '@/components/tool-kit/output';
import { Status } from '@/components/tool-kit/fields';
import { formatBytes } from '@/lib/format';
import { adler32, crc32, hex32 } from './security';

function FileChecksum() {
  const [rows, setRows] = useState<Array<{ label: string; value: string; emphasis?: boolean }> | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  return (
    <section className="card-plain stack" aria-labelledby="crc-file">
      <h2 id="crc-file" className="h3">Checksum of a file</h2>
      <FileDrop
        onFiles={async ([f]) => {
          setBusy(true);
          setError(null);
          try {
            let c = 0;
            const reader = f.stream().getReader();
            for (;;) {
              const { done, value } = await reader.read();
              if (done) break;
              c = crc32(value, c);
            }
            setRows([{ label: 'File', value: `${f.name} (${formatBytes(f.size)})` }, { label: 'CRC-32 (hex)', value: hex32(c).toUpperCase(), emphasis: true }, { label: 'CRC-32 (decimal)', value: String(c) }]);
          } catch {
            setError('The file could not be read.');
          } finally {
            setBusy(false);
          }
        }}
      />
      {busy && <p className="summary">Reading…</p>}
      {error && <Status tone="error">{error}</Status>}
      {rows && <ResultRows rows={rows} />}
    </section>
  );
}

export default function Crc32Checksum() {
  return (
    <div className="stack">
      <TransformTool
        inputLabel="Text (UTF-8)"
        allowEmpty
        allowFile={false}
        example="123456789"
        transform={(t) => {
          const b = new TextEncoder().encode(t);
          const c = crc32(b);
          return { output: `CRC-32:   ${hex32(c).toUpperCase()}  (${c})\nAdler-32: ${hex32(adler32(b)).toUpperCase()}` };
        }}
      />
      <FileChecksum />
      <p className="field-hint">CRC-32 detects accidental corruption (it’s used in ZIP and PNG). It is not a security hash: anyone can create a different file with the same CRC.</p>
    </div>
  );
}
