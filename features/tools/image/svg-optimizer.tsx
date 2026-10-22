'use client';

import { useMemo, useState } from 'react';
import { Button, OpenTextFileButton } from '@/components/tool-kit/actions';
import { CheckboxField, RangeField, Status, TextAreaField } from '@/components/tool-kit/fields';
import { useObjectUrl } from '@/components/tool-kit/files';
import { OutputPanel } from '@/components/tool-kit/output';
import { defaultSvgOptions, optimizeSvg, type SvgOptions } from './svg-optimize';

const EXAMPLE = `<?xml version="1.0" encoding="UTF-8" standalone="no"?>
<!-- Created with an editor -->
<svg xmlns="http://www.w3.org/2000/svg" xmlns:inkscape="http://www.inkscape.org/namespaces/inkscape" version="1.1" width="120" height="120" viewBox="0 0 120.000 120.000" onload="alert('hi')" inkscape:version="1.3">
  <metadata id="meta1">Exported 2026</metadata>
  <title id="title1">Sun badge</title>
  <script>document.title = 'pwned'</script>
  <defs>
    <linearGradient id="sun" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0.000000" stop-color="#ffcf4a"/>
      <stop offset="1.000000" stop-color="#ff7a1a"/>
    </linearGradient>
  </defs>
  <g>
    <g id="layer1" inkscape:label="Layer 1">
      <circle id="circle12" cx="60.000000" cy="60.000000" r="34.123456" fill="url(#sun)" fill-opacity="1"/>
      <path id="path14" d="M 60.000 8.000 L 60.000 18.000 M 60.000 102.000 L 60.000 112.000 M 8.000 60.000 L 18.000 60.000 M 102.000 60.000 L 112.000 60.000" stroke="#ff9a2a" stroke-width="6.000" stroke-linecap="round"/>
    </g>
  </g>
  <a href="javascript:alert(1)"><text x="60" y="66" text-anchor="middle" font-size="16" font-family="Arial" fill="#5a2a00">SUN</text></a>
</svg>`;

const kb = (n: number) => (n < 1024 ? `${n} B` : `${(n / 1024).toFixed(1)} KB`);

export default function SvgOptimizer() {
  const [src, setSrc] = useState('');
  const [name, setName] = useState('image.svg');
  const [o, setO] = useState<SvgOptions>(defaultSvgOptions);
  const [err, setErr] = useState<string | null>(null);
  const set = <K extends keyof SvgOptions>(k: K, v: SvgOptions[K]) => setO((p) => ({ ...p, [k]: v }));
  const result = useMemo(() => {
    if (!src.trim()) return null;
    try {
      return { ok: optimizeSvg(src, o) } as const;
    } catch (e) {
      return { error: (e as Error).message } as const;
    }
  }, [src, o]);
  const res = result && 'ok' in result ? result.ok : null;
  const blob = useMemo(() => (res ? new Blob([res.svg], { type: 'image/svg+xml' }) : null), [res]);
  const url = useObjectUrl(blob);
  const saved = res ? Math.max(0, Math.round((1 - res.after / Math.max(1, res.before)) * 100)) : 0;

  return (
    <div className="stack">
      <div className="tool-grid">
        <div className="tool-col">
          <TextAreaField label="SVG code" hint="Paste markup or open an .svg file. It is processed as text and previewed as an image, so scripts in it never run." value={src} onChange={setSrc} rows={11} placeholder="<svg xmlns=…" />
          <div className="actions">
            <OpenTextFileButton
              accept=".svg,image/svg+xml"
              label="Open .svg"
              onText={(t, n) => {
                setSrc(t);
                setName(n || 'image.svg');
                setErr(null);
              }}
              onError={setErr}
            />
            <Button variant="ghost" onClick={() => (setSrc(EXAMPLE), setName('sun.svg'))}>
              Load example
            </Button>
            <Button variant="ghost" onClick={() => setSrc('')}>
              Reset
            </Button>
          </div>
          {err && <Status tone="error">{err}</Status>}
        </div>
        <div className="tool-col">
          <RangeField label="Decimal places" hint="Lower is smaller; raise it if small icons change shape." value={o.precision} onChange={(v) => set('precision', v)} min={0} max={6} />
          <CheckboxField label="Remove links to other files and sites" hint="External images, fonts and CSS url() — they could track viewers or break offline." checked={o.removeExternalRefs} onChange={(v) => set('removeExternalRefs', v)} />
          <CheckboxField label="Remove editor data and metadata" checked={o.removeEditorData} onChange={(v) => set('removeEditorData', v)} />
          <CheckboxField label="Remove comments" checked={o.removeComments} onChange={(v) => set('removeComments', v)} />
          <CheckboxField label="Remove unused ids" checked={o.removeUnusedIds} onChange={(v) => set('removeUnusedIds', v)} />
          <CheckboxField label="Remove <title> and <desc>" hint="Keep them when the image needs an accessible name." checked={o.removeTitleDesc} onChange={(v) => set('removeTitleDesc', v)} />
          <CheckboxField label="Indented output" checked={o.pretty} onChange={(v) => set('pretty', v)} />
        </div>
      </div>
      {result && 'error' in result && <Status tone="error">{result.error}</Status>}
      {res && (
        <>
          <dl className="stat-grid">
            <div className="stat">
              <dt>Before</dt>
              <dd>{kb(res.before)}</dd>
            </div>
            <div className="stat">
              <dt>After</dt>
              <dd>{kb(res.after)}</dd>
            </div>
            <div className="stat">
              <dt>Saved</dt>
              <dd>{saved}%</dd>
            </div>
            <div className="stat">
              <dt>Size</dt>
              <dd>{res.width && res.height ? `${res.width} × ${res.height}` : res.viewBox ? res.viewBox.split(/[\s,]+/).slice(2).join(' × ') : '—'}</dd>
            </div>
          </dl>
          {res.removed.length > 0 ? (
            <Status tone="warn">
              Removed for safety: {res.removed.slice(0, 8).join(', ')}
              {res.removed.length > 8 ? ` and ${res.removed.length - 8} more` : ''}.
            </Status>
          ) : (
            <Status tone="success">Nothing unsafe was found.</Status>
          )}
          {res.cleaned.length > 0 && <p className="field-hint">Cleaned up: {res.cleaned.join(', ')}.</p>}
          <div className="tool-grid">
            <div className="tool-col">
              <OutputPanel label="Optimized SVG" value={res.svg} filename={name.replace(/(\.min)?\.svg$/i, '') + '.min.svg'} mime="image/svg+xml" rows={12} />
            </div>
            <div className="tool-col">
              <div className="output-head">
                <strong>Preview</strong>
              </div>
              {url && (
                <div className="checker" style={{ borderRadius: 10, padding: 12, display: 'grid', placeItems: 'center', minHeight: 200 }}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={url} alt="Preview of the optimized SVG" style={{ maxWidth: '100%', maxHeight: 300, width: res.width || res.viewBox ? undefined : 200 }} />
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
