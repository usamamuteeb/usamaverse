'use client';

import { useEffect, useRef, useState } from 'react';
import { Button, DownloadBlobButton } from '@/components/tool-kit/actions';
import { NumberField, RangeField, SelectField, Status, TextAreaField, TextField } from '@/components/tool-kit/fields';
import { FileDrop } from '@/components/tool-kit/files';
import { formatBytes } from '@/lib/format';
import { detectSignature } from '@/features/tools/files/logic';
import { pdfBlob, useSinglePdf } from '@/features/tools/files/usePdf';
import { applyOverlays, readForm, type FontChoice, type Overlay } from './ops';
import { FONTS } from './choices';
import { ResultPreview, usePdfPreview } from './PageGrid';
import { PageNav, PageView, svgY } from './PageView';
import { rectFromPoints } from './redact';

type Tool = 'text' | 'rect' | 'highlight' | 'whiteout' | 'ink' | 'image';

const TOOLS: Array<{ value: Tool; label: string }> = [
  { value: 'text', label: 'Text — click to place' },
  { value: 'highlight', label: 'Highlight — drag' },
  { value: 'rect', label: 'Box outline — drag' },
  { value: 'whiteout', label: 'White-out — drag' },
  { value: 'ink', label: 'Freehand pen — draw' },
  { value: 'image', label: 'Image — click to place' },
];

const CSS_FONT: Record<FontChoice, string> = { Helvetica: 'Helvetica, Arial, sans-serif', HelveticaBold: 'Helvetica, Arial, sans-serif', TimesRoman: '"Times New Roman", Times, serif', Courier: '"Courier New", Courier, monospace' };

export default function EditPdf() {
  const { pdf, picker } = useSinglePdf();
  const { doc } = usePdfPreview(pdf?.bytes ?? null);
  const [page, setPage] = useState(1);
  const [tool, setTool] = useState<Tool>('text');
  const [text, setText] = useState('Your text');
  const [size, setSize] = useState('14');
  const [color, setColor] = useState('#000000');
  const [font, setFont] = useState<FontChoice>('Helvetica');
  const [stroke, setStroke] = useState(2);
  const [img, setImg] = useState<{ data: Uint8Array; mime: 'image/png' | 'image/jpeg'; url: string; ratio: number } | null>(null);
  const [imgWidth, setImgWidth] = useState(120);
  const [items, setItems] = useState<Overlay[]>([]);
  const [draft, setDraft] = useState<{ a: { x: number; y: number }; b: { x: number; y: number }; pts: Array<[number, number]> } | null>(null);
  const [signed, setSigned] = useState(false);
  const imageUrls = useRef(new WeakMap<Uint8Array, string>());
  const allUrls = useRef<string[]>([]);
  useEffect(() => () => allUrls.current.forEach((u) => URL.revokeObjectURL(u)), []);
  const [out, setOut] = useState<Uint8Array | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setItems([]);
    setOut(null);
    setPage(1);
    setSigned(false);
    if (pdf) readForm(pdf.bytes).then((r) => setSigned(r.signed)).catch(() => undefined);
  }, [pdf]);

  const add = (o: Overlay) => {
    setItems((x) => [...x, o]);
    setOut(null);
  };
  const p0 = page - 1;
  const fontSize = Math.min(144, Math.max(4, Number(size) || 14));

  const onDown = (pt: { x: number; y: number }) => setDraft({ a: pt, b: pt, pts: [[pt.x, pt.y]] });
  const onMove = (pt: { x: number; y: number }) => setDraft((d) => (d ? { ...d, b: pt, pts: tool === 'ink' ? [...d.pts, [pt.x, pt.y]] : d.pts } : d));
  const onUp = (pt: { x: number; y: number }) => {
    const d = draft;
    setDraft(null);
    if (!d) return;
    setError(null);
    if (tool === 'text') {
      if (!text.trim()) return setError('Type the text to add first.');
      add({ kind: 'text', page: p0, x: pt.x, y: pt.y - fontSize * 0.8, text, size: fontSize, color, font });
    } else if (tool === 'image') {
      if (!img) return setError('Choose an image first.');
      const h = imgWidth / img.ratio;
      add({ kind: 'image', page: p0, x: pt.x - imgWidth / 2, y: pt.y - h / 2, width: imgWidth, height: h, data: img.data, mime: img.mime });
    } else if (tool === 'ink') {
      if (d.pts.length > 1) add({ kind: 'ink', page: p0, points: [...d.pts, [pt.x, pt.y]], color, width: stroke });
    } else {
      const r = rectFromPoints(d.a, pt);
      if (r.width < 2 || r.height < 2) return;
      if (tool === 'highlight') add({ kind: 'rect', page: p0, ...r, fill: '#ffe600', opacity: 0.35 });
      else if (tool === 'whiteout') add({ kind: 'rect', page: p0, ...r, fill: '#ffffff' });
      else add({ kind: 'rect', page: p0, ...r, stroke: color, strokeWidth: stroke });
    }
  };

  const onPage = items.map((o, i) => ({ o, i })).filter(({ o }) => o.page === p0);
  const describe = (o: Overlay) => (o.kind === 'text' ? `Text “${o.text.slice(0, 24)}”` : o.kind === 'rect' ? (o.fill === '#ffffff' ? 'White-out' : o.fill ? 'Highlight' : 'Box') : o.kind === 'ink' ? 'Pen stroke' : 'Image');

  return (
    <div className="tool-grid">
      <div className="tool-col">
        {picker}
        {pdf && doc && (
          <>
            <SelectField label="Tool" value={tool} onChange={(v) => setTool(v as Tool)} options={TOOLS} />
            {tool === 'text' && (
              <>
                <TextAreaField label="Text to add" value={text} onChange={setText} rows={3} mono={false} />
                <div className="form-grid">
                  <NumberField label="Size" suffix="pt" value={size} onChange={setSize} />
                  <SelectField label="Font" value={font} onChange={(v) => setFont(v as FontChoice)} options={FONTS} />
                </div>
              </>
            )}
            {(tool === 'text' || tool === 'rect' || tool === 'ink') && <TextField type="color" label="Color" value={color} onChange={setColor} />}
            {(tool === 'rect' || tool === 'ink') && <RangeField label="Line width" value={stroke} min={1} max={12} onChange={setStroke} format={(v) => `${v} pt`} />}
            {tool === 'image' && (
              <>
                <FileDrop
                  accept="image/png,image/jpeg"
                  label="Choose image"
                  onFiles={async ([f]) => {
                    const data = new Uint8Array(await f.arrayBuffer());
                    const sig = detectSignature(data.subarray(0, 16));
                    if (!sig || !['image/png', 'image/jpeg'].includes(sig.mime)) return setError('Choose a PNG or JPEG image.');
                    const bmp = await createImageBitmap(f);
                    const ratio = bmp.width / bmp.height;
                    bmp.close();
                    const url = URL.createObjectURL(f);
                    imageUrls.current.set(data, url);
                    allUrls.current.push(url);
                    setImg({ data, mime: sig.mime as 'image/png', url, ratio });
                  }}
                />
                <RangeField label="Image width" value={imgWidth} min={20} max={500} onChange={setImgWidth} format={(v) => `${v} pt`} />
              </>
            )}
            {tool === 'whiteout' && <Status tone="warn">White-out only covers content visually. The text underneath is still in the file — use Redact PDF to remove it.</Status>}
            <div className="actions">
              <Button variant="ghost" onClick={() => { setItems((x) => x.slice(0, -1)); setOut(null); }} disabled={!items.length}>
                Undo
              </Button>
              <Button variant="ghost" onClick={() => { setItems((x) => x.filter((o) => o.page !== p0)); setOut(null); }} disabled={!onPage.length}>
                Clear this page
              </Button>
            </div>
            {onPage.length > 0 && (
              <ul className="file-list" aria-label="Additions on this page">
                {onPage.map(({ o, i }) => (
                  <li key={i}>
                    <span className="file-name">{describe(o)}</span>
                    <button type="button" className="icon-btn danger" aria-label={`Delete ${describe(o)}`} onClick={() => { setItems((x) => x.filter((_, k) => k !== i)); setOut(null); }}>
                      ✕
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </>
        )}
      </div>
      <div className="tool-col">
        {signed && <Status tone="warn">This PDF has a digital signature. Editing it will invalidate the signature.</Status>}
        {pdf && doc && (
          <>
            <PageNav page={page} count={doc.numPages} onChange={setPage} />
            <PageView
              doc={doc}
              pageNumber={page}
              label={`Page ${page} — use the selected tool on the page`}
              cursor={tool === 'text' || tool === 'image' ? 'copy' : 'crosshair'}
              onPointerDown={onDown}
              onPointerMove={onMove}
              onPointerUp={onUp}
              overlay={(m) => (
                <>
                  {onPage.map(({ o, i }) => {
                    if (o.kind === 'text')
                      return o.text.split('\n').map((line, k) => (
                        <text key={`${i}-${k}`} x={o.x} y={svgY(m, o.y - k * o.size * 1.2)} fontSize={o.size} fill={o.color} fontFamily={CSS_FONT[o.font]} fontWeight={o.font === 'HelveticaBold' ? 700 : 400}>
                          {line}
                        </text>
                      ));
                    if (o.kind === 'rect') return <rect key={i} x={o.x} y={svgY(m, o.y + o.height)} width={o.width} height={o.height} fill={o.fill ?? 'none'} fillOpacity={o.opacity ?? 1} stroke={o.stroke ?? 'none'} strokeWidth={o.strokeWidth ?? 0} />;
                    if (o.kind === 'ink') return <polyline key={i} points={o.points.map(([x, y]) => `${x},${svgY(m, y)}`).join(' ')} fill="none" stroke={o.color} strokeWidth={o.width} strokeLinecap="round" strokeLinejoin="round" />;
                    const href = imageUrls.current.get(o.data);
                    return href ? <image key={i} href={href} x={o.x} y={svgY(m, o.y + o.height)} width={o.width} height={o.height} /> : <rect key={i} x={o.x} y={svgY(m, o.y + o.height)} width={o.width} height={o.height} fill="#ccc" />;
                  })}
                  {draft && tool === 'ink' && <polyline points={draft.pts.map(([x, y]) => `${x},${svgY(m, y)}`).join(' ')} fill="none" stroke={color} strokeWidth={stroke} strokeLinecap="round" />}
                  {draft && (tool === 'rect' || tool === 'highlight' || tool === 'whiteout') && (() => {
                    const r = rectFromPoints(draft.a, draft.b);
                    return <rect x={r.x} y={svgY(m, r.y + r.height)} width={r.width} height={r.height} fill="none" stroke="#f04459" strokeDasharray="4 3" />;
                  })()}
                </>
              )}
            />
            <Button
              variant="primary"
              disabled={!items.length}
              onClick={async () => {
                setError(null);
                try {
                  setOut(await applyOverlays(pdf.bytes, items));
                } catch (e) {
                  setError(e instanceof Error ? e.message : String(e));
                }
              }}
            >
              Save edited PDF ({items.length} change{items.length === 1 ? '' : 's'})
            </Button>
          </>
        )}
        {!pdf && <p className="empty-state">Add text, highlights, boxes, drawings and images on top of PDF pages. Existing text in the PDF is not changed.</p>}
        {error && <Status tone="error">{error}</Status>}
        {out && pdf && (
          <>
            <ResultPreview bytes={out} page={page} />
            <DownloadBlobButton blob={pdfBlob(out)} filename={`${pdf.base}-edited.pdf`} label={`Download PDF (${formatBytes(out.length)})`} />
          </>
        )}
      </div>
    </div>
  );
}
