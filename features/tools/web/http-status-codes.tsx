'use client';

import { useState } from 'react';
import { TextField } from '@/components/tool-kit/fields';
import { HTTP_STATUS } from './more';

const CLASS: Record<string, string> = { '1': 'Informational', '2': 'Success', '3': 'Redirection', '4': 'Client error', '5': 'Server error' };

export default function HttpStatusCodes() {
  const [q, setQ] = useState('');
  const t = q.trim().toLowerCase();
  const rows = HTTP_STATUS.filter(([c, n, d]) => !t || String(c).startsWith(t) || n.toLowerCase().includes(t) || d.toLowerCase().includes(t));
  return (
    <div className="stack">
      <TextField label="Search by code or words" value={q} onChange={setQ} placeholder="404, redirect, rate limit…" />
      <div className="table-scroll">
        <table className="data-table">
          <thead><tr><th scope="col">Code</th><th scope="col">Name</th><th scope="col">Meaning</th></tr></thead>
          <tbody>
            {rows.map(([c, n, d]) => (
              <tr key={c}>
                <td className="mono"><strong>{c}</strong><br /><span className="muted">{CLASS[String(c)[0]]}</span></td>
                <td>{n}</td>
                <td>{d}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {rows.length === 0 && <p className="empty-state">No status code matches “{q}”.</p>}
    </div>
  );
}
