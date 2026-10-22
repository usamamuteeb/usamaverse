'use client';

import { useEffect, useRef, useState } from 'react';
import { Button, DownloadBlobButton } from '@/components/tool-kit/actions';
import { NumberField, RangeField, SelectField, Status, TextAreaField, TextField } from '@/components/tool-kit/fields';
import { FileDrop } from '@/components/tool-kit/files';
import { formatBytes } from '@/lib/format';
import { detectSignature } from '@/features/tools/files/logic';
import { pdfBlob, usePdfWorkspace, useSinglePdf } from '@/features/tools/files/usePdf';
import { readInfo } from '@/features/tools/files/pdf';
import { applyOverlays, readForm, type FontChoice, type Overlay } from './ops';
import { editExistingText, locateEditableText, type EditableText, type TextChange } from './content-edit';
import { FONTS } from './choices';
import { PageThumb, ResultPreview, usePdfPreview } from './PageGrid';
import { PageNav, PageView, svgY } from './PageView';
import { rectFromPoints } from './redact';
import { hitOverlay, moveOverlay, overlayBounds, type Point } from './editor-model';

type Tool = 'select' | 'replace' | 'text' | 'rect' | 'highlight' | 'whiteout' | 'ink' | 'image';

const TOOLS: Array<{ value: Tool; label: string }> = [
  { value: 'select', label: 'Select & move — drag an addition' },
  { value: 'replace', label: 'Edit existing text — click the PDF text' },
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
  const shared = usePdfWorkspace();
  const { doc } = usePdfPreview(pdf?.bytes ?? null);
  const [page, setPage] = useState(1);
  const [zoom, setZoom] = useState(1);
  const [tool, setTool] = useState<Tool>('text');
  const [text, setText] = useState('Your text');
  const [size, setSize] = useState('14');
  const [color, setColor] = useState('#000000');
  const [font, setFont] = useState<FontChoice>('Helvetica');
  const [stroke, setStroke] = useState(2);
  const [selectedWidth, setSelectedWidth] = useState('120');
  const [selectedHeight, setSelectedHeight] = useState('80');
  const [candidate, setCandidate] = useState<EditableText | null>(null);
  const [replacementText, setReplacementText] = useState('');
  const [replacements, setReplacements] = useState<TextChange[]>([]);
  const [busy, setBusy] = useState(false);
  const [img, setImg] = useState<{ data: Uint8Array; mime: 'image/png' | 'image/jpeg'; url: string; ratio: number } | null>(null);
  const [imgWidth, setImgWidth] = useState(120);
  const [items, setItems] = useState<Overlay[]>([]);
  const [selected, setSelected] = useState<number | null>(null);
  const [past, setPast] = useState<Overlay[][]>([]);
  const [future, setFuture] = useState<Overlay[][]>([]);
  const moving = useRef<{ start: Point; base: Overlay[]; index: number } | null>(null);
  const [draft, setDraft] = useState<{ a: { x: number; y: number }; b: { x: number; y: number }; pts: Array<[number, number]> } | null>(null);
  const [signed, setSigned] = useState(false);
  const imageUrls = useRef(new WeakMap<Uint8Array, string>());
  const allUrls = useRef<string[]>([]);
  useEffect(() => () => allUrls.current.forEach((u) => URL.revokeObjectURL(u)), []);
  const [out, setOut] = useState<Uint8Array | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setItems([]);
    setSelected(null);
    setPast([]);
    setFuture([]);
    setReplacements([]);
    setCandidate(null);
    setOut(null);
    setPage(1);
    setSigned(false);
    if (pdf) readForm(pdf.bytes).then((r) => setSigned(r.signed)).catch(() => undefined);
  }, [pdf]);

  const commit = (next: Overlay[]) => {
    setPast((history) => [...history.slice(-39), items]);
    setFuture([]);
    setItems(next);
    setOut(null);
  };
  const add = (o: Overlay) => { commit([...items, o]); setSelected(items.length); };
  const undo = () => {
    if (!past.length) return;
    setFuture((history) => [items, ...history]);
    setItems(past[past.length - 1]);
    setPast((history) => history.slice(0, -1));
    setSelected(null);
    setOut(null);
  };
  const redo = () => {
    if (!future.length) return;
    setPast((history) => [...history, items]);
    setItems(future[0]);
    setFuture((history) => history.slice(1));
    setSelected(null);
    setOut(null);
  };
  const p0 = page - 1;
  const fontSize = Math.min(144, Math.max(4, Number(size) || 14));
  const selectedItem = selected === null ? null : items[selected] ?? null;

  const onDown = (pt: Point) => {
    if (tool === 'replace') return;
    if (tool === 'select') {
      const index = hitOverlay(items, p0, pt);
      setSelected(index);
      if (index !== null) {
        moving.current = { start: pt, base: items, index };
        const item = items[index];
        if (item.kind === 'text') { setText(item.text); setSize(String(item.size)); setColor(item.color); setFont(item.font); }
        if (item.kind === 'rect' || item.kind === 'image') { setSelectedWidth(String(Math.round(item.width))); setSelectedHeight(String(Math.round(item.height))); }
      }
      return;
    }
    setDraft({ a: pt, b: pt, pts: [[pt.x, pt.y]] });
  };
  const onMove = (pt: Point) => {
    if (tool === 'replace') return;
    if (tool === 'select' && moving.current) {
      const { start, base, index } = moving.current;
      setItems(base.map((item, i) => i === index ? moveOverlay(item, pt.x - start.x, pt.y - start.y) : item));
      setOut(null);
      return;
    }
    setDraft((d) => (d ? { ...d, b: pt, pts: tool === 'ink' ? [...d.pts, [pt.x, pt.y]] : d.pts } : d));
  };
  const onUp = async (pt: { x: number; y: number }) => {
    if (tool === 'replace') {
      try {
        const target = await locateEditableText(pdf!.bytes, p0, pt);
        if (!target) { setError('No editable PDF text object was found here. Scanned words are pixels; OCR makes them searchable but does not change the visible scan.'); return; }
        setCandidate(target);
        const pending = replacements.find((item) => item.page === target.page && item.objectIndex === target.objectIndex);
        setReplacementText(pending?.text ?? target.original);
        setSize(String(Number((pending?.fontSize ?? target.fontSize).toFixed(2))));
        setColor(pending?.color ?? target.color);
        setError(null);
      } catch (e) { setError(e instanceof Error ? e.message : String(e)); }
      return;
    }
    if (tool === 'select') {
      const drag = moving.current;
      moving.current = null;
      if (drag && (Math.abs(pt.x - drag.start.x) > 0.5 || Math.abs(pt.y - drag.start.y) > 0.5)) {
        setPast((history) => [...history.slice(-39), drag.base]);
        setFuture([]);
        setItems(drag.base.map((item, i) => i === drag.index ? moveOverlay(item, pt.x - drag.start.x, pt.y - drag.start.y) : item));
      }
      return;
    }
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
    <div className="tool-grid pdf-editor-grid">
      <div className="tool-col">
        {picker}
        {pdf && doc && (
          <>
            <SelectField label="Tool" value={tool} onChange={(v) => { setTool(v as Tool); setSelected(null); }} options={TOOLS} />
            {(tool === 'text' || (tool === 'select' && selectedItem?.kind === 'text')) && (
              <>
                <TextAreaField label={tool === 'select' ? 'Selected text' : 'Text to add'} value={text} onChange={setText} rows={3} mono={false} />
                <div className="form-grid">
                  <NumberField label="Size" suffix="pt" value={size} onChange={setSize} />
                  <SelectField label="Font" value={font} onChange={(v) => setFont(v as FontChoice)} options={FONTS} />
                </div>
              </>
            )}
            {(tool === 'text' || tool === 'rect' || tool === 'ink' || (tool === 'select' && selectedItem?.kind === 'text')) && <TextField type="color" label="Color" value={color} onChange={setColor} />}
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
            {tool === 'replace' && <>
              <Status tone="info">Click existing text on the page. The selected PDF text object is rewritten in place when you save, keeping the page as PDF content. Text does not reflow, so review longer replacements for overlap. Scanned words are pixels and cannot be changed this way.</Status>
              {candidate && <div className="editor-selection-panel"><strong>Selected: “{candidate.original.slice(0, 80)}”</strong>
                <TextAreaField label="Replacement text" value={replacementText} onChange={setReplacementText} rows={3} mono={false} />
                <div className="form-grid"><NumberField label="Text size" suffix="pt" value={size} onChange={setSize} /><TextField type="color" label="Text color" value={color} onChange={setColor} /></div>
                <Button onClick={() => {
                  if (replacementText.includes('\n') || replacementText.includes('\r')) { setError('Existing text objects can be replaced with one line. Add a new text box for multiple lines.'); return; }
                  const nextSize = Number(size);
                  if (!(nextSize >= 4 && nextSize <= 144)) { setError('Text size must be between 4 and 144 points.'); return; }
                  setReplacements((current) => [...current.filter((item) => item.page !== candidate.page || item.objectIndex !== candidate.objectIndex), { ...candidate, text: replacementText, fontSize: nextSize, color }]);
                  setCandidate(null); setOut(null); setError(null);
                }}>Apply replacement</Button>
                <Button variant="ghost" onClick={() => setCandidate(null)}>Cancel</Button>
              </div>}
              {replacements.some((item) => item.page === p0) && <ul className="file-list" aria-label="Text replacements on this page">{replacements.map((item, index) => item.page === p0 && <li key={index}><span className="file-name">“{item.original.slice(0, 30)}” → “{item.text.slice(0, 30)}”</span><button type="button" className="icon-btn danger" aria-label={`Remove replacement ${index + 1}`} onClick={() => { setReplacements((current) => current.filter((_, i) => i !== index)); setOut(null); }}>✕</button></li>)}</ul>}
            </>}
            {tool === 'select' && selectedItem && <div className="editor-selection-panel">
              <strong>Selected: {selectedItem.kind === 'text' ? 'Text' : selectedItem.kind === 'rect' ? 'Shape' : selectedItem.kind === 'ink' ? 'Drawing' : 'Image'}</strong>
              <p className="muted">Drag it on the page to reposition it. Changes can be undone before saving.</p>
              {selectedItem.kind === 'text' && <Button variant="secondary" onClick={() => {
                if (!text.trim()) { setError('Text cannot be empty.'); return; }
                commit(items.map((item, i) => i === selected ? { ...selectedItem, text, size: fontSize, color, font } : item));
              }}>Apply text changes</Button>}
              {(selectedItem.kind === 'rect' || selectedItem.kind === 'image') && <>
                <div className="form-grid"><NumberField label="Width" suffix="pt" value={selectedWidth} onChange={setSelectedWidth} /><NumberField label="Height" suffix="pt" value={selectedHeight} onChange={setSelectedHeight} /></div>
                <Button onClick={() => {
                  const width = Number(selectedWidth), height = Number(selectedHeight);
                  if (!(width >= 1 && width <= 3000 && height >= 1 && height <= 3000)) { setError('Width and height must be between 1 and 3000 pt.'); return; }
                  commit(items.map((item, i) => i === selected ? { ...selectedItem, width, height } : item));
                }}>Apply size</Button>
              </>}
              <Button variant="ghost" onClick={() => { commit(items.filter((_, i) => i !== selected)); setSelected(null); }}>Delete selected</Button>
            </div>}
            <div className="actions">
              <Button variant="ghost" onClick={undo} disabled={!past.length}>
                Undo
              </Button>
              <Button variant="ghost" onClick={redo} disabled={!future.length}>Redo</Button>
              <Button variant="ghost" onClick={() => { commit(items.filter((o) => o.page !== p0)); setSelected(null); }} disabled={!onPage.length}>
                Clear this page
              </Button>
            </div>
            {onPage.length > 0 && (
              <ul className="file-list" aria-label="Additions on this page">
                {onPage.map(({ o, i }) => (
                  <li key={i}>
                    <span className="file-name">{describe(o)}</span>
                    <button type="button" className="icon-btn danger" aria-label={`Delete ${describe(o)}`} onClick={() => { commit(items.filter((_, k) => k !== i)); setSelected(null); }}>
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
            <div className="pdf-editor-toolbar">
              <PageNav page={page} count={doc.numPages} onChange={(next) => { setPage(next); setCandidate(null); }} />
              <div className="pdf-editor-zoom" role="group" aria-label="PDF zoom">
                <button type="button" className="btn btn-secondary" onClick={() => setZoom((value) => Math.max(0.5, +(value - 0.25).toFixed(2)))} disabled={zoom <= 0.5} aria-label="Zoom out">−</button>
                <span aria-live="polite">{Math.round(zoom * 100)}%</span>
                <button type="button" className="btn btn-secondary" onClick={() => setZoom((value) => Math.min(2.5, +(value + 0.25).toFixed(2)))} disabled={zoom >= 2.5} aria-label="Zoom in">+</button>
              </div>
            </div>
            <div className="pdf-editor-stage">
              <aside className="pdf-editor-thumbnails" aria-label="PDF page thumbnails">
                {Array.from({ length: doc.numPages }, (_, index) => (
                  <button key={index} type="button" className={page === index + 1 ? 'pdf-editor-thumbnail is-active' : 'pdf-editor-thumbnail'} onClick={() => { setPage(index + 1); setCandidate(null); }} aria-label={`Go to page ${index + 1}`} aria-current={page === index + 1 ? 'page' : undefined}>
                    <PageThumb doc={doc} pageNumber={index + 1} width={88} alt="" />
                    <span>{index + 1}</span>
                  </button>
                ))}
              </aside>
              <div className="pdf-editor-canvas">
            <PageView
              doc={doc}
              pageNumber={page}
              label={`Page ${page} — use the selected tool on the page`}
              cursor={tool === 'select' ? 'grab' : tool === 'text' || tool === 'image' || tool === 'replace' ? 'copy' : 'crosshair'}
              style={{ width: 760 * zoom, maxWidth: 'none' }}
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
                  {tool === 'select' && selectedItem && selectedItem.page === p0 && (() => {
                    const b = overlayBounds(selectedItem);
                    return <rect x={b.x - 3} y={svgY(m, b.y + b.height + 3)} width={b.width + 6} height={b.height + 6} fill="none" stroke="#d72543" strokeWidth={2} strokeDasharray="6 4" pointerEvents="none" />;
                  })()}
                  {replacements.filter((item) => item.page === p0).map((item, index) => <rect key={`replace-${index}`} x={item.box.x - 2} y={svgY(m, item.box.y + item.box.height + 2)} width={item.box.width + 4} height={item.box.height + 4} fill="none" stroke="#b63246" strokeWidth={1.5} strokeDasharray="5 3" pointerEvents="none" />)}
                  {candidate && tool === 'replace' && <rect x={candidate.box.x} y={svgY(m, candidate.box.y + candidate.box.height)} width={candidate.box.width} height={candidate.box.height} fill="none" stroke="#d72543" strokeWidth={2} strokeDasharray="6 4" pointerEvents="none" />}
                  {candidate && tool === 'replace' && <foreignObject x={candidate.box.x} y={svgY(m, candidate.box.y + candidate.box.height) - 4} width={Math.max(candidate.box.width + 36, 100)} height={Math.max(candidate.box.height + 20, 32)}>
                    <input className="pdf-editor-inline-text" aria-label="Edit selected PDF text" value={replacementText} onChange={(e) => setReplacementText(e.target.value)} onPointerDown={(e) => e.stopPropagation()} onPointerUp={(e) => e.stopPropagation()} />
                  </foreignObject>}
                  {draft && tool === 'ink' && <polyline points={draft.pts.map(([x, y]) => `${x},${svgY(m, y)}`).join(' ')} fill="none" stroke={color} strokeWidth={stroke} strokeLinecap="round" />}
                  {draft && (tool === 'rect' || tool === 'highlight' || tool === 'whiteout') && (() => {
                    const r = rectFromPoints(draft.a, draft.b);
                    return <rect x={r.x} y={svgY(m, r.y + r.height)} width={r.width} height={r.height} fill="none" stroke="#f04459" strokeDasharray="4 3" />;
                  })()}
                </>
              )}
            />
              </div>
            </div>
            <Button
              variant="primary"
              disabled={busy || (!items.length && !replacements.length)}
              onClick={async () => {
                setError(null);
                setBusy(true);
                try {
                  const base = await editExistingText(pdf.bytes, replacements);
                  setOut(items.length ? await applyOverlays(base, items) : base);
                } catch (e) {
                  setError(e instanceof Error ? e.message : String(e));
                } finally { setBusy(false); }
              }}
            >
              {busy ? 'Saving…' : `Save edited PDF (${items.length + replacements.length} change${items.length + replacements.length === 1 ? '' : 's'})`}
            </Button>
          </>
        )}
        {!pdf && <p className="empty-state">Edit directly on PDF pages: add and move text, highlights, drawings and images, or click existing text to replace it.</p>}
        {error && <Status tone="error">{error}</Status>}
        {out && pdf && (
          <>
            <ResultPreview bytes={out} page={page} />
            <DownloadBlobButton blob={pdfBlob(out)} filename={`${pdf.base}-edited.pdf`} label={`Download PDF (${formatBytes(out.length)})`} />
            {shared && <Button onClick={async () => {
              try {
                const name = `${pdf.base}-edited.pdf`;
                const info = await readInfo(out);
                shared.setPdf({ name, base: pdf.base + '-edited', bytes: out, info });
              } catch (e) { setError(e instanceof Error ? e.message : String(e)); }
            }}>Continue with this version</Button>}
          </>
        )}
      </div>
    </div>
  );
}
