'use client';

import { useState } from 'react';
import { Status } from '@/components/tool-kit/fields';
import { FileDrop } from '@/components/tool-kit/files';
import { formatBytes } from '@/lib/format';
import { readMetadata, type MetaEntry } from './exif';

export default function ImageMetadata() {
  const [name, setName] = useState('');
  const [res, setRes] = useState<{ format: string; entries: MetaEntry[] } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const groups = ['File', 'Image', 'Camera', 'GPS', 'Text'] as const;
  const sensitive = res?.entries.filter((e) => e.sensitive) ?? [];
  return (
    <div className="tool-grid">
      <div className="tool-col">
        <FileDrop
          accept="image/jpeg,image/png,image/webp"
          label="Choose photo"
          onFiles={async ([f]) => {
            setError(null);
            setRes(null);
            try {
              if (f.size > 100 * 1024 * 1024) throw new Error('Files up to 100 MB.');
              const r = readMetadata(await f.arrayBuffer());
              if (r.format === 'unknown') throw new Error('Metadata reading supports JPEG, PNG and WebP.');
              setRes(r);
              setName(`${f.name} (${formatBytes(f.size)})`);
            } catch (e) {
              setError(e instanceof Error ? e.message : String(e));
            }
          }}
        />
        <p className="field-hint">The file is read on your device. To remove metadata, re-save the image with any of the image tools here (Resize, Compress, Crop…) — they don’t copy EXIF or GPS data.</p>
      </div>
      <div className="tool-col">
        {error && <Status tone="error">{error}</Status>}
        {res && (
          <>
            <p className="summary">{name} — {res.format}</p>
            {sensitive.length > 0 && <Status tone="warn">This image contains potentially identifying data ({sensitive.map((s) => s.tag).join(', ')}). Remove it before sharing publicly.</Status>}
            {res.entries.length === 0 && <Status tone="info">No EXIF, GPS or text metadata found.</Status>}
            {groups.map((g) => {
              const list = res.entries.filter((e) => e.group === g);
              if (!list.length) return null;
              return (
                <div key={g} className="table-scroll">
                  <table className="data-table compact">
                    <caption>{g}</caption>
                    <tbody>
                      {list.map((e, i) => (
                        <tr key={i}>
                          <th scope="row">{e.tag}{e.sensitive ? ' ⚠' : ''}</th>
                          <td className="mono">{e.value}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              );
            })}
          </>
        )}
      </div>
    </div>
  );
}
