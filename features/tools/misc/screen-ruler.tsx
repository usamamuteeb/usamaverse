'use client';

import { useState, type PointerEvent } from 'react';
import { Button } from '@/components/tool-kit/actions';
import { RangeField, Status } from '@/components/tool-kit/fields';

const CARD_MM = 85.6;
export default function ScreenRuler() {
  const [cardPx, setCardPx] = useState(324);
  const [calibrated, setCalibrated] = useState(false);
  const [marks, setMarks] = useState<number[]>([]);
  const [cursor, setCursor] = useState(0);
  const pxPerMm = cardPx / CARD_MM;
  const width = 200 * pxPerMm;
  const mark = (e: PointerEvent<HTMLDivElement>) => {
    const x = Math.max(0, Math.min(width, e.clientX - e.currentTarget.getBoundingClientRect().left));
    setCursor(x);
    setMarks((old) => old.length === 1 ? [old[0], x] : [x]);
  };
  const distance = marks.length === 2 ? Math.abs(marks[1] - marks[0]) : 0;
  return <div className="stack">
    <p>Calibrate against the long edge of a standard bank card (85.6 mm). Hold the card against the bar and adjust its width until they match.</p>
    <RangeField label="Calibration bar width" value={cardPx} min={200} max={600} step={1} onChange={(v) => { setCardPx(v); setCalibrated(true); setMarks([]); }} format={(v) => `${v} screen pixels`} />
    <div className="ruler-card" style={{ width: cardPx }} aria-label="85.6 millimetre calibration bar">85.6 mm card edge</div>
    <p className="field-hint">Changing browser zoom, display scaling or the monitor invalidates this calibration. <a href="https://www.iso.org/standard/70483.html" target="_blank" rel="noopener noreferrer">ID-1 card size reference</a>.</p>
    <div className="ruler-scroll"><div className="screen-ruler" style={{ width }} onPointerDown={mark} role="button" tabIndex={0} aria-label="Select two positions to measure a distance. Arrow keys move the cursor; Enter marks a point." onKeyDown={(e) => {
      if (e.key === 'Escape') { setMarks([]); return; }
      if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') { e.preventDefault(); setCursor((x) => Math.max(0, Math.min(width, x + (e.key === 'ArrowRight' ? pxPerMm : -pxPerMm)))); }
      if (e.key === 'Home') { e.preventDefault(); setCursor(0); }
      if (e.key === 'End') { e.preventDefault(); setCursor(width); }
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setMarks((old) => old.length === 1 ? [old[0], cursor] : [cursor]); }
    }}>
      {Array.from({ length: 201 }, (_, i) => <span key={i} className={i % 10 === 0 ? 'ruler-tick major' : i % 5 === 0 ? 'ruler-tick mid' : 'ruler-tick'} style={{ left: i * pxPerMm }}>{i % 10 === 0 && <small>{i}</small>}</span>)}
      <span className="ruler-cursor" style={{ left: cursor }} />
      {marks.map((x, i) => <span key={i} className="ruler-mark" style={{ left: x }} />)}
      {marks.length === 2 && <span className="ruler-selection" style={{ left: Math.min(...marks), width: distance }} />}
    </div></div>
    <div className="actions"><Button variant="ghost" onClick={() => setMarks([])}>Clear marks</Button></div>
    {marks.length === 1 && <Status tone="info">Select a second position on the ruler. You can also use arrow keys and Enter.</Status>}
    {marks.length === 2 && <p className="summary" aria-live="polite">Distance: <strong>{distance.toFixed(1)} screen px</strong> · {calibrated ? `${(distance / pxPerMm).toFixed(1)} mm / ${(distance / pxPerMm / 25.4).toFixed(2)} in` : 'Calibrate first for physical units.'}</p>}
    {!calibrated && <Status tone="info">Physical units appear after calibration. Screen pixels are available now.</Status>}
  </div>;
}
