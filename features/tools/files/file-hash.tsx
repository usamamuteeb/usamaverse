'use client';

import { useState } from 'react';
import { CopyButton } from '@/components/tool-kit/actions';
import { Status, TextField } from '@/components/tool-kit/fields';
import { FileDrop } from '@/components/tool-kit/files';
import { formatBytes } from '@/lib/format';
import { crc32, hex32, toHex } from '@/features/tools/generators/security';

const MAX = 1024 * 1024 * 1024;
const ALGS = ['SHA-256', 'SHA-512', 'SHA-384', 'SHA-1'] as const;

export default function FileHash() {
  const [name, setName] = useState('');
  const [hashes, setHashes] = useState<Array<[string, string]>>([]);
  const [expected, setExpected] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const exp = expected.trim().toLowerCase().replace(/\s+/g, '');
  const match = exp ? hashes.find(([, h]) => h.toLowerCase() === exp) : undefined;
  return (
    <div className="tool-grid">
      <div className="tool-col">
        <FileDrop
          onFiles={async ([f]) => {
            setError(null);
            setHashes([]);
            if (f.size > MAX) return setError(`Files up to ${formatBytes(MAX)} (the browser must hold the file in memory).`);
            setBusy(true);
            try {
              const buf = await f.arrayBuffer();
              const out: Array<[string, string]> = [];
              for (const a of ALGS) out.push([a, toHex(new Uint8Array(await crypto.subtle.digest(a, buf)))]);
              out.push(['CRC-32', hex32(crc32(new Uint8Array(buf)))]);
              setHashes(out);
              setName(`${f.name} (${formatBytes(f.size)})`);
            } catch {
              setError('Hashing failed. Web Crypto needs a secure (https) page, and very large files may exceed available memory.');
            } finally {
              setBusy(false);
            }
          }}
        />
        <TextField label="Expected checksum to compare (optional)" value={expected} onChange={setExpected} placeholder="Paste the hash from the download page" />
      </div>
      <div className="tool-col">
        {busy && <p className="summary">Hashing…</p>}
        {error && <Status tone="error">{error}</Status>}
        {hashes.length > 0 && (
          <>
            <p className="summary">{name}</p>
            {exp && (match ? <Status tone="success">Matches the {match[0]} checksum.</Status> : <Status tone="error">Does not match any computed checksum. The file may be different, corrupted, or the expected value is for another algorithm.</Status>)}
            <dl className="result-rows">
              {hashes.map(([a, h]) => (
                <div className="result-row" key={a}>
                  <dt>{a}{a === 'SHA-1' ? ' (legacy)' : ''}</dt>
                  <dd className="mono with-action">{h} <CopyButton text={h} /></dd>
                </div>
              ))}
            </dl>
          </>
        )}
      </div>
    </div>
  );
}
