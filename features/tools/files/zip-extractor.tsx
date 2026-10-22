'use client';

import { useState } from 'react';
import { Button } from '@/components/tool-kit/actions';
import { Status } from '@/components/tool-kit/fields';
import { FileDrop } from '@/components/tool-kit/files';
import { downloadBlob } from '@/lib/tools/shared/download';
import { formatBytes } from '@/lib/format';
import { extractZipEntry, inspectZip, type ZipEntry } from './zip-extract';

export default function ZipExtractor() {
  const [bytes, setBytes] = useState<Uint8Array | null>(null);
  const [entries, setEntries] = useState<ZipEntry[]>([]);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState('');
  return <div className="stack">
    <FileDrop accept=".zip,application/zip" label="Open a ZIP archive" onFiles={async (files) => {
      setError(''); setEntries([]); setBytes(null);
      try { const data = new Uint8Array(await files[0].arrayBuffer()); setEntries(inspectZip(data)); setBytes(data); }
      catch (e) { setError(e instanceof Error ? e.message : String(e)); }
    }} />
    {error && <Status tone="error">{error}</Status>}
    {bytes && <><p className="summary">{entries.length} files · {formatBytes(entries.reduce((n, e) => n + e.size, 0))} expanded. Download files individually below.</p>
      <div className="table-scroll"><table className="data-table compact"><thead><tr><th>File</th><th>Size</th><th>Compressed</th><th>Action</th></tr></thead><tbody>{entries.map((e, i) => <tr key={`${e.name}-${i}`}><td>{e.name}</td><td>{formatBytes(e.size)}</td><td>{formatBytes(e.packed)}</td><td><Button disabled={!!busy} onClick={async () => {
        setError(''); setBusy(e.name);
        try { const data = await extractZipEntry(bytes, e); downloadBlob(new Blob([data as BlobPart]), e.name.split(/[\\/]/).at(-1) || 'file'); }
        catch (err) { setError(err instanceof Error ? err.message : String(err)); }
        finally { setBusy(''); }
      }}>{busy === e.name ? 'Extracting…' : 'Download'}</Button></td></tr>)}</tbody></table></div>
    </>}
    <p className="field-hint">Stored and Deflate ZIP entries are supported. Encrypted and ZIP64 archives are rejected. Files stay in the browser; nothing is written into a folder automatically.</p>
  </div>;
}
