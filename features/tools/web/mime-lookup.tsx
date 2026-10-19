'use client';

import { useState } from 'react';
import { TextField } from '@/components/tool-kit/fields';
import { MIME_TYPES } from './more';

export default function MimeLookup() {
  const [q, setQ] = useState('');
  const t = q.trim().toLowerCase().replace(/^\./, '');
  const rows = MIME_TYPES.filter(([ext, mime, desc]) => !t || ext.includes(t) || mime.includes(t) || desc.toLowerCase().includes(t));
  return (
    <div className="stack">
      <TextField label="Search by extension, MIME type or description" value={q} onChange={setQ} placeholder=".webp, application/json, font…" />
      <p className="summary" aria-live="polite">{rows.length} match{rows.length === 1 ? '' : 'es'}</p>
      <div className="table-scroll">
        <table className="data-table compact">
          <thead><tr><th scope="col">Extension</th><th scope="col">MIME type</th><th scope="col">Description</th></tr></thead>
          <tbody>
            {rows.map(([e, m, d]) => (
              <tr key={e}><td className="mono">.{e}</td><td className="mono">{m}</td><td>{d}</td></tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="field-hint">Common, registered types. Servers can send other types; for files you have, the File Type Inspector checks the real content.</p>
    </div>
  );
}
