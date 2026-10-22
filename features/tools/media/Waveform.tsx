'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { duration, waveformPeaks, type Pcm } from './audio';

/**
 * Waveform with an optional draggable selection. The selection can also be set
 * with the start/end fields next to it, so the canvas is not the only way in.
 */
export function Waveform({
  pcm,
  start,
  end,
  onSelect,
  playhead,
  height = 120,
  label = 'Waveform',
}: {
  pcm: Pcm;
  start?: number;
  end?: number;
  onSelect?: (start: number, end: number) => void;
  playhead?: number | null;
  height?: number;
  label?: string;
}) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const wrap = useRef<HTMLDivElement>(null);
  const [w, setW] = useState(600);
  const total = duration(pcm);
  const peaks = useMemo(() => waveformPeaks(pcm, Math.max(50, Math.min(4000, Math.round(w)))), [pcm, w]);
  const drag = useRef<number | null>(null);

  useEffect(() => {
    const el = wrap.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setW(el.clientWidth || 600));
    ro.observe(el);
    setW(el.clientWidth || 600);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    const c = canvas.current;
    if (!c) return;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    c.width = Math.round(w * dpr);
    c.height = Math.round(height * dpr);
    const g = c.getContext('2d');
    if (!g) return;
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    const css = getComputedStyle(c);
    const accent = css.getPropertyValue('--accent').trim() || '#e5484d';
    const muted = css.getPropertyValue('--muted').trim() || '#888';
    const text = css.getPropertyValue('--text').trim() || '#fff';
    g.clearRect(0, 0, w, height);
    const mid = height / 2;
    const sel = start !== undefined && end !== undefined && end > start;
    const x0 = sel ? (start! / total) * w : 0;
    const x1 = sel ? (end! / total) * w : w;
    if (sel) {
      g.fillStyle = accent;
      g.globalAlpha = 0.14;
      g.fillRect(x0, 0, x1 - x0, height);
      g.globalAlpha = 1;
    }
    peaks.forEach(([lo, hi], x) => {
      const inside = !sel || (x >= x0 && x <= x1);
      g.fillStyle = inside ? accent : muted;
      g.globalAlpha = inside ? 0.95 : 0.45;
      const y0 = mid - hi * mid * 0.95;
      const y1 = mid - lo * mid * 0.95;
      g.fillRect(x, y0, 1, Math.max(1, y1 - y0));
    });
    g.globalAlpha = 1;
    if (sel) {
      g.fillStyle = text;
      g.fillRect(x0 - 1, 0, 2, height);
      g.fillRect(x1 - 1, 0, 2, height);
    }
    if (playhead != null && playhead >= 0) {
      g.fillStyle = text;
      g.fillRect((playhead / total) * w - 0.5, 0, 1, height);
    }
  }, [peaks, w, height, start, end, playhead, total]);

  const timeAt = (clientX: number) => {
    const r = canvas.current!.getBoundingClientRect();
    return Math.max(0, Math.min(total, ((clientX - r.left) / r.width) * total));
  };

  return (
    <div ref={wrap} className="waveform">
      <canvas
        ref={canvas}
        role="img"
        aria-label={`${label}${start !== undefined && end !== undefined ? `, selection ${start.toFixed(2)} to ${end.toFixed(2)} seconds` : ''}`}
        style={{ width: '100%', height, cursor: onSelect ? 'crosshair' : 'default', touchAction: onSelect ? 'none' : 'auto' }}
        onPointerDown={(e) => {
          if (!onSelect) return;
          const t = timeAt(e.clientX);
          // grab the nearer edge if close to one, otherwise start a new selection
          const near = (x: number | undefined) => x !== undefined && Math.abs(((x - t) / total) * w) < 8;
          drag.current = near(start) ? end! : near(end) ? start! : t;
          (e.target as HTMLCanvasElement).setPointerCapture(e.pointerId);
          if (!near(start) && !near(end)) onSelect(t, t);
        }}
        onPointerMove={(e) => {
          if (drag.current === null || !onSelect) return;
          const t = timeAt(e.clientX);
          onSelect(Math.min(drag.current, t), Math.max(drag.current, t));
        }}
        onPointerUp={() => {
          drag.current = null;
        }}
      />
    </div>
  );
}
