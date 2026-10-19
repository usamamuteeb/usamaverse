'use client';

import { useEffect, useState } from 'react';
import { Button } from '@/components/tool-kit/actions';
import { Status, TextField } from '@/components/tool-kit/fields';
import { explainCron, nextRuns, parseCron } from './cron';

const EXAMPLES = ['*/15 * * * *', '0 9 * * 1-5', '30 2 1 * *', '0 0 * * 0', '@daily', '0 8-18/2 * * mon-fri'];

export default function CronExplainer() {
  const [expr, setExpr] = useState('0 9 * * 1-5');
  const [now, setNow] = useState<Date | null>(null);
  useEffect(() => setNow(new Date()), []);
  let text = '';
  let runs: Date[] = [];
  let error: string | null = null;
  if (expr.trim()) {
    try {
      const spec = parseCron(expr);
      text = explainCron(spec);
      if (now) runs = nextRuns(spec, now, 6);
    } catch (e) {
      error = e instanceof Error ? e.message : String(e);
    }
  }
  return (
    <div className="tool-grid">
      <div className="tool-col">
        <TextField label="Cron expression (minute hour day month weekday)" value={expr} onChange={setExpr} />
        <div className="actions">
          {EXAMPLES.map((e) => <Button key={e} variant="ghost" onClick={() => setExpr(e)}>{e}</Button>)}
        </div>
        <p className="field-hint">Standard 5-field cron as used by Linux crontab. Seconds fields and Quartz symbols (? L W #) aren’t supported.</p>
      </div>
      <div className="tool-col">
        {error && <Status tone="error">{error}</Status>}
        {text && (
          <p className="big-result" aria-live="polite">
            <span className="big-result-label">Runs</span>
            <span className="big-result-value" style={{ fontSize: '1.2rem' }}>{text}</span>
          </p>
        )}
        {runs.length > 0 && (
          <>
            <h2 className="field-label">Next runs (your local time)</h2>
            <ol className="history mono">{runs.map((r) => <li key={r.getTime()}>{r.toLocaleString(undefined, { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</li>)}</ol>
            <p className="field-hint">Servers often run cron in UTC or their own time zone, so actual times may be shifted.</p>
          </>
        )}
      </div>
    </div>
  );
}
