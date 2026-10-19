'use client';

import { useState } from 'react';
import { Button, CopyButton } from '@/components/tool-kit/actions';
import { Status, TextAreaField } from '@/components/tool-kit/fields';
import { ResultRows } from '@/components/tool-kit/output';
import { parseUrlParts } from './logic';

export default function UrlParser() {
  const [input, setInput] = useState('');
  let parts: ReturnType<typeof parseUrlParts> | null = null;
  let error: string | null = null;
  if (input.trim()) {
    try {
      parts = parseUrlParts(input);
    } catch (e) {
      error = e instanceof Error ? e.message : String(e);
    }
  }
  return (
    <div className="tool-grid">
      <div className="tool-col">
        <TextAreaField label="URL" value={input} onChange={setInput} rows={4} placeholder="https://example.com:8080/path?a=1&a=2#top" hint="Nothing is fetched; the URL is only parsed in your browser." />
        <div className="actions">
          <Button variant="ghost" onClick={() => setInput('https://user@shop.example.com:8443/products/caf%C3%A9?id=42&tag=new&tag=sale&utm_source=mail#reviews')}>
            Load example
          </Button>
          <Button variant="ghost" onClick={() => setInput('')}>
            Reset
          </Button>
        </div>
      </div>
      <div className="tool-col">
        {error && <Status tone="error">{error}</Status>}
        {parts && (
          <>
            <ResultRows
              rows={[
                { label: 'Protocol', value: parts.protocol },
                { label: 'Username', value: parts.username || '—' },
                { label: 'Password', value: parts.hasPassword ? 'present (hidden)' : '—' },
                { label: 'Host', value: parts.hostname, emphasis: true },
                { label: 'Port', value: parts.port || '—' },
                { label: 'Origin', value: parts.origin },
                { label: 'Path', value: parts.pathname },
                { label: 'Path (decoded)', value: parts.decodedPath },
                { label: 'Query string', value: parts.search || '—' },
                { label: 'Fragment', value: parts.hash || '—' },
              ]}
            />
            {parts.hasPassword && <Status tone="warn">This URL contains a password. Avoid sharing it.</Status>}
            {parts.params.length > 0 && (
              <div className="table-scroll">
                <table className="data-table">
                  <caption>Query parameters ({parts.params.length})</caption>
                  <thead>
                    <tr>
                      <th scope="col">#</th>
                      <th scope="col">Key</th>
                      <th scope="col">Value (decoded)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {parts.params.map((p) => (
                      <tr key={p.index}>
                        <td>{p.index}</td>
                        <td className="mono">{p.key}</td>
                        <td className="mono">{p.value || <span className="muted">(empty)</span>}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            <div className="actions">
              <CopyButton text={JSON.stringify({ ...parts, params: parts.params.map(({ key, value }) => ({ key, value })) }, null, 2)} label="Copy as JSON" />
            </div>
          </>
        )}
      </div>
    </div>
  );
}
