'use client';

import { useEffect, useState } from 'react';
import { Button } from '@/components/tool-kit/actions';
import { Status, TextAreaField } from '@/components/tool-kit/fields';
import { ResultRows } from '@/components/tool-kit/output';
import { parseUserAgent } from './more';

export default function UserAgentParser() {
  const [ua, setUa] = useState('');
  const [mine, setMine] = useState('');
  useEffect(() => setMine(navigator.userAgent), []);
  let r: ReturnType<typeof parseUserAgent> | null = null;
  let error: string | null = null;
  if (ua.trim()) {
    try {
      r = parseUserAgent(ua);
    } catch (e) {
      error = e instanceof Error ? e.message : String(e);
    }
  }
  return (
    <div className="tool-grid">
      <div className="tool-col">
        <TextAreaField label="User-agent string" value={ua} onChange={setUa} rows={4} />
        <div className="actions">
          <Button variant="ghost" onClick={() => setUa(mine)} disabled={!mine}>Use my browser’s</Button>
          <Button variant="ghost" onClick={() => setUa('')}>Reset</Button>
        </div>
      </div>
      <div className="tool-col">
        {error && <Status tone="error">{error}</Status>}
        {r && (
          <>
            <ResultRows rows={[{ label: 'Browser', value: `${r.browser} ${r.version}`.trim(), emphasis: true }, { label: 'Engine', value: r.engine }, { label: 'Operating system', value: r.os }, { label: 'Device type', value: r.device }]} />
            {r.notes.map((n) => <Status key={n} tone="info">{n}</Status>)}
          </>
        )}
        <p className="field-hint">A best-effort guess from the text. User-agent strings can be faked and browsers increasingly reduce the details they share.</p>
      </div>
    </div>
  );
}
