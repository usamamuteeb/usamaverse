'use client';

import { useMemo, useState } from 'react';
import { Button, OpenTextFileButton } from '@/components/tool-kit/actions';
import { Status, TextAreaField } from '@/components/tool-kit/fields';
import { analyzeHtml, type Severity } from './html-analyze';

const EXAMPLE = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Lumen Shop — handmade lamps and lighting for every room of your home</title>
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <link rel="stylesheet" href="/styles.css">
  <script src="http://cdn.example.com/analytics.js"></script>
</head>
<body>
  <h2>Welcome</h2>
  <h4>Today's deals</h4>
  <p>Browse our <a href="/lamps">lamps</a> or <a href="https://example.org" target="_blank">click here</a>.</p>
  <a href="/cart"><img src="cart.svg" alt="Cart" width="24" height="24"></a>
  <img src="hero.jpg">
  <form action="/search"><input name="q" placeholder="Search"><button onclick="go()"></button></form>
  <div id="promo"></div><div id="promo"></div>
</body>
</html>`;

const VIEWS = ['Issues', 'Overview', 'Headings', 'Links', 'Images & resources'] as const;
type View = (typeof VIEWS)[number];
const SEV_LABEL: Record<Severity, string> = { error: 'Error', warn: 'Warning', info: 'Tip' };

export default function HtmlAnalyzer() {
  const [html, setHtml] = useState('');
  const [view, setView] = useState<View>('Issues');
  const [err, setErr] = useState<string | null>(null);
  const report = useMemo(() => (html.trim() ? analyzeHtml(html) : null), [html]);
  const n = (s: Severity) => report?.findings.filter((f) => f.severity === s).length ?? 0;
  const linkKinds = report ? Object.entries(report.links.reduce<Record<string, number>>((m, l) => ({ ...m, [l.kind]: (m[l.kind] ?? 0) + 1 }), {})) : [];

  return (
    <div className="stack">
      <TextAreaField label="HTML" hint="Paste markup or open an .html file. It is only read as text — never rendered, fetched or run." value={html} onChange={setHtml} rows={10} placeholder="<!DOCTYPE html>…" />
      <div className="actions">
        <Button variant="ghost" onClick={() => setHtml(EXAMPLE)}>
          Load example
        </Button>
        <OpenTextFileButton accept=".html,.htm,.xhtml,.svg,.txt,text/html" onText={(t) => (setHtml(t), setErr(null))} onError={setErr} />
        <Button variant="ghost" onClick={() => setHtml('')}>
          Reset
        </Button>
      </div>
      {err && <Status tone="error">{err}</Status>}
      {report && (
        <>
          <dl className="stat-grid">
            <div className="stat">
              <dt>Errors</dt>
              <dd>{n('error')}</dd>
            </div>
            <div className="stat">
              <dt>Warnings</dt>
              <dd>{n('warn')}</dd>
            </div>
            <div className="stat">
              <dt>Tips</dt>
              <dd>{n('info')}</dd>
            </div>
            <div className="stat">
              <dt>Elements</dt>
              <dd>{Object.values(report.counts).reduce((a, b) => a + b, 0).toLocaleString()}</dd>
            </div>
            <div className="stat">
              <dt>Words</dt>
              <dd>{report.words.toLocaleString()}</dd>
            </div>
          </dl>
          <div className="rt-views" role="tablist" aria-label="Report sections">
            {VIEWS.map((v) => (
              <button key={v} type="button" role="tab" aria-selected={view === v} className={view === v ? 'is-active' : ''} onClick={() => setView(v)}>
                {v}
              </button>
            ))}
          </div>
          {view === 'Issues' &&
            (report.findings.length ? (
              <ul className="findings">
                {report.findings.map((f, k) => (
                  <li key={k} className={`finding sev-${f.severity}`}>
                    <span className="finding-sev">{SEV_LABEL[f.severity]}</span>
                    <span className="finding-area">{f.area}</span>
                    <span className="finding-msg">{f.message}</span>
                    {f.line && <span className="finding-line">line {f.line}</span>}
                  </li>
                ))}
              </ul>
            ) : (
              <Status tone="success">No issues found by these checks.</Status>
            ))}
          {view === 'Overview' && (
            <div className="table-scroll">
              <table className="data-table compact">
                <tbody>
                  {report.meta.map((m) => (
                    <tr key={m.label}>
                      <th scope="row">{m.label}</th>
                      <td className="cell">{m.value}</td>
                    </tr>
                  ))}
                  <tr>
                    <th scope="row">Most used tags</th>
                    <td className="cell">
                      {Object.entries(report.counts)
                        .sort((a, b) => b[1] - a[1])
                        .slice(0, 14)
                        .map(([t, c]) => `${t} ×${c}`)
                        .join(' · ')}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          )}
          {view === 'Headings' &&
            (report.headings.length ? (
              <ol className="heading-outline">
                {report.headings.map((h, k) => (
                  <li key={k} style={{ paddingLeft: `${(h.level - 1) * 18}px` }}>
                    <span className="badge-tag">h{h.level}</span> {h.text || <em>(empty)</em>}
                  </li>
                ))}
              </ol>
            ) : (
              <Status tone="info">No headings.</Status>
            ))}
          {view === 'Links' &&
            (report.links.length ? (
              <>
                <p className="muted" style={{ margin: 0, fontSize: "0.85rem" }}>{linkKinds.map(([k, c]) => `${c} ${k}`).join(' · ')}</p>
                <div className="table-scroll">
                  <table className="data-table compact">
                    <thead>
                      <tr>
                        <th>Text</th>
                        <th>Link</th>
                        <th>Type</th>
                        <th>Line</th>
                      </tr>
                    </thead>
                    <tbody>
                      {report.links.map((l, k) => (
                        <tr key={k}>
                          <td className="cell">{l.text || <em>(none)</em>}</td>
                          <td className="cell mono">{l.href}</td>
                          <td>{l.kind}</td>
                          <td>{l.line}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            ) : (
              <Status tone="info">No links.</Status>
            ))}
          {view === 'Images & resources' && (
            <div className="table-scroll">
              <table className="data-table compact">
                <thead>
                  <tr>
                    <th>Kind</th>
                    <th>URL</th>
                    <th>Alt text</th>
                    <th>Line</th>
                  </tr>
                </thead>
                <tbody>
                  {report.images.map((im, k) => (
                    <tr key={`i${k}`}>
                      <td>image</td>
                      <td className="cell mono">{im.src}</td>
                      <td className="cell">{im.alt === null ? <strong>missing</strong> : im.alt || <em>decorative (alt=&quot;&quot;)</em>}</td>
                      <td>{im.line}</td>
                    </tr>
                  ))}
                  {report.resources.map((r, k) => (
                    <tr key={`r${k}`}>
                      <td>{r.kind}</td>
                      <td className="cell mono">{r.url}</td>
                      <td>—</td>
                      <td>{r.line}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {!report.images.length && !report.resources.length && <Status tone="info">No images, scripts, stylesheets or embeds.</Status>}
            </div>
          )}
        </>
      )}
    </div>
  );
}
