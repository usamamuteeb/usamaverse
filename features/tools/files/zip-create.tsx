'use client';

import { useEffect, useState } from 'react';
import { Button, DownloadBlobButton } from '@/components/tool-kit/actions';
import { CheckboxField, Status, TextField } from '@/components/tool-kit/fields';
import { FileDrop, nextId, OrderedFileList, type OrderedItem } from '@/components/tool-kit/files';
import { formatBytes } from '@/lib/format';
import { canDeflate, createZip, ZIP_MAX_TOTAL } from './zip';

interface Item extends OrderedItem { file: File }

export default function ZipCreate() {
  const [items, setItems] = useState<Item[]>([]);
  const [compress, setCompress] = useState(true);
  const [deflateOk, setDeflateOk] = useState(true);
  const [name, setName] = useState('archive.zip');
  const [out, setOut] = useState<Blob | null>(null);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => setDeflateOk(canDeflate()), []);
  const total = items.reduce((n, i) => n + i.size, 0);
  return (
    <div className="tool-grid">
      <div className="tool-col">
        <FileDrop multiple label="Add files" onFiles={(fs) => { setOut(null); setItems((x) => [...x, ...fs.map((f) => ({ id: nextId(), name: (f as File & { webkitRelativePath?: string }).webkitRelativePath || f.name, size: f.size, file: f }))]); }} />
        <OrderedFileList items={items} onChange={(x) => { setItems(x); setOut(null); }} label="Files in the archive" />
        {items.length > 0 && <p className="summary">{items.length} file{items.length === 1 ? '' : 's'}, {formatBytes(total)}</p>}
        <CheckboxField label={deflateOk ? 'Compress (Deflate)' : 'Compress (not supported in this browser — files will be stored)'} checked={compress && deflateOk} onChange={setCompress} />
        <TextField label="ZIP file name" value={name} onChange={setName} />
        <div className="actions">
          <Button
            variant="primary"
            disabled={!items.length || busy}
            onClick={async () => {
              setError(null);
              setBusy(true);
              try {
                if (total > ZIP_MAX_TOTAL) throw new Error(`Total ${formatBytes(total)} is over the ${formatBytes(ZIP_MAX_TOTAL)} in-browser limit.`);
                const files: Array<{ name: string; data: Uint8Array; date: Date }> = [];
                for (const it of items) files.push({ name: it.name, data: new Uint8Array(await it.file.arrayBuffer()), date: new Date(it.file.lastModified) });
                const r = await createZip(files, { compress });
                setOut(new Blob([r.bytes as BlobPart], { type: 'application/zip' }));
                setNote(`${r.deflated} compressed, ${r.stored} stored as-is (already compressed or tiny).`);
              } catch (e) {
                setError(e instanceof Error ? e.message : String(e));
              } finally {
                setBusy(false);
              }
            }}
          >
            {busy ? 'Building ZIP…' : 'Create ZIP'}
          </Button>
          {items.length > 0 && <Button variant="ghost" onClick={() => { setItems([]); setOut(null); }}>Reset</Button>}
        </div>
      </div>
      <div className="tool-col">
        {error && <Status tone="error">{error}</Status>}
        {out ? (
          <>
            <Status tone="success">ZIP ready: {formatBytes(out.size)} (from {formatBytes(total)}). {note}</Status>
            <DownloadBlobButton blob={out} filename={(name.trim() || 'archive.zip').replace(/[\\/:*?"<>|]+/g, '_').replace(/(\.zip)?$/i, '.zip')} label="Download ZIP" />
          </>
        ) : (
          <p className="empty-state">Add files, then create the archive. Nothing is uploaded.</p>
        )}
        <p className="field-hint">Standard ZIP without ZIP64 (up to 4 GB and 65,535 files; 1 GB in total here because it’s built in memory). File names are UTF-8; duplicate names get “(2)”.</p>
      </div>
    </div>
  );
}
