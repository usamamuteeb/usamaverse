'use client';

import { useRef, useState } from 'react';
import { Button } from '@/components/tool-kit/actions';
import { CheckboxField, SelectField, Status, TextField } from '@/components/tool-kit/fields';
import { FileDrop, useObjectUrl } from '@/components/tool-kit/files';
import { downloadBlob } from '@/lib/tools/shared/download';
import { canvasToBlob } from '@/features/tools/image/useImage';
import { formatTime, parseTime } from './audio';
import { baseName } from './browser';

const FORMATS = [
  { value: 'image/png', label: 'PNG (lossless)' },
  { value: 'image/jpeg', label: 'JPEG' },
  { value: 'image/webp', label: 'WebP' },
];
const EXT: Record<string, string> = { 'image/png': 'png', 'image/jpeg': 'jpg', 'image/webp': 'webp' };

function seek(v: HTMLVideoElement, t: number): Promise<void> {
  return new Promise((resolve, reject) => {
    const done = () => {
      v.removeEventListener('seeked', done);
      v.removeEventListener('error', fail);
      // give the decoder a frame to paint
      requestAnimationFrame(() => resolve());
    };
    const fail = () => {
      v.removeEventListener('seeked', done);
      reject(new Error('The video could not seek to that time.'));
    };
    v.addEventListener('seeked', done);
    v.addEventListener('error', fail);
    v.currentTime = Math.min(Math.max(0, t), Math.max(0, v.duration - 0.001));
  });
}

export default function VideoThumbnail() {
  const [file, setFile] = useState<File | null>(null);
  const url = useObjectUrl(file);
  const video = useRef<HTMLVideoElement>(null);
  const [meta, setMeta] = useState<{ w: number; h: number; d: number } | null>(null);
  const [time, setTime] = useState('0:00.00');
  const [fmt, setFmt] = useState('image/png');
  const [cols, setCols] = useState('4');
  const [rows, setRows] = useState('4');
  const [sheetWidth, setSheetWidth] = useState('1600');
  const [stamps, setStamps] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<string | null>(null);

  const capture = async () => {
    const v = video.current;
    if (!v || !meta || !file) return;
    setError(null);
    try {
      const t = parseTime(time);
      if (Number.isFinite(t) && Math.abs(t - v.currentTime) > 0.001) await seek(v, t);
      const c = document.createElement('canvas');
      c.width = v.videoWidth;
      c.height = v.videoHeight;
      c.getContext('2d')!.drawImage(v, 0, 0);
      const blob = await canvasToBlob(c, fmt, 0.92);
      downloadBlob(blob, `${baseName(file.name)}-${formatTime(v.currentTime).replace(/[:.]/g, '-')}.${EXT[fmt]}`);
    } catch (e) {
      setError((e as Error).message);
    }
  };

  const contactSheet = async () => {
    if (!url || !meta || !file) return;
    setError(null);
    const C = Math.max(1, Math.min(10, Math.round(Number(cols) || 4)));
    const R = Math.max(1, Math.min(20, Math.round(Number(rows) || 4)));
    const W = Math.max(320, Math.min(8000, Math.round(Number(sheetWidth) || 1600)));
    const pad = Math.round(W / 200) + 2;
    const cellW = Math.floor((W - pad * (C + 1)) / C);
    const cellH = Math.round((cellW * meta.h) / meta.w);
    const header = Math.round(W / 40) + 12;
    const c = document.createElement('canvas');
    c.width = W;
    c.height = header + R * cellH + pad * (R + 1);
    const g = c.getContext('2d')!;
    g.fillStyle = '#111';
    g.fillRect(0, 0, c.width, c.height);
    g.fillStyle = '#eee';
    g.font = `600 ${Math.round(header * 0.45)}px system-ui, sans-serif`;
    g.textBaseline = 'middle';
    g.fillText(`${file.name} · ${meta.w}×${meta.h} · ${formatTime(meta.d, 0)}`, pad, header / 2 + pad / 2);
    // a separate element so the visible player is not disturbed
    const v = document.createElement('video');
    v.muted = true;
    v.preload = 'auto';
    v.src = url;
    v.playsInline = true;
    try {
      await new Promise<void>((res, rej) => {
        v.onloadeddata = () => res();
        v.onerror = () => rej(new Error('The video could not be decoded for thumbnails.'));
      });
      const n = C * R;
      for (let i = 0; i < n; i++) {
        setBusy(`Capturing frame ${i + 1} of ${n}…`);
        const t = (meta.d * (i + 0.5)) / n;
        await seek(v, t);
        const x = pad + (i % C) * (cellW + pad);
        const y = header + pad + Math.floor(i / C) * (cellH + pad);
        g.drawImage(v, x, y, cellW, cellH);
        if (stamps) {
          const label = formatTime(t, 0);
          g.font = `600 ${Math.max(10, Math.round(cellW / 14))}px ui-monospace, monospace`;
          const tw = g.measureText(label).width + 8;
          const th = Math.max(14, Math.round(cellW / 10));
          g.fillStyle = 'rgba(0,0,0,0.65)';
          g.fillRect(x + cellW - tw - 4, y + cellH - th - 4, tw, th);
          g.fillStyle = '#fff';
          g.fillText(label, x + cellW - tw, y + cellH - th / 2 - 4);
        }
      }
      const blob = await canvasToBlob(c, fmt === 'image/png' ? 'image/jpeg' : fmt, 0.9);
      if (preview) URL.revokeObjectURL(preview);
      setPreview(URL.createObjectURL(blob));
      downloadBlob(blob, `${baseName(file.name)}-contact-sheet.${fmt === 'image/webp' ? 'webp' : 'jpg'}`);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(null);
      v.removeAttribute('src');
      v.load();
    }
  };

  return (
    <div className="stack">
      {!file && (
        <FileDrop accept="video/*,.mp4,.m4v,.mov,.webm,.mkv,.ogv" onFiles={(f) => (setFile(f[0]), setMeta(null), setError(null))} label="Choose video">
          <p>Choose a video to save a still frame or a contact sheet of thumbnails. Everything happens on your device.</p>
        </FileDrop>
      )}
      {error && <Status tone="error">{error}</Status>}
      {file && url && (
        <>
          <video
            ref={video}
            className="media-player"
            controls
            preload="auto"
            src={url}
            onLoadedMetadata={(e) => {
              const v = e.currentTarget;
              setMeta({ w: v.videoWidth, h: v.videoHeight, d: v.duration });
            }}
            onTimeUpdate={(e) => setTime(formatTime(e.currentTarget.currentTime))}
            onError={() => setError('This browser cannot play this video, so frames cannot be captured. MP4 (H.264) works in every browser.')}
            style={{ width: '100%', maxHeight: 420, background: '#000', borderRadius: 10 }}
          />
          {meta && (
            <>
              <p className="field-hint" style={{ margin: 0 }}>
                {meta.w} × {meta.h} · {formatTime(meta.d)} — pause the video on the frame you want, or type a time.
              </p>
              <div className="form-grid">
                <TextField label="Time" value={time} onChange={setTime} hint="m:ss.00 or seconds" />
                <SelectField label="Image format" value={fmt} onChange={setFmt} options={FORMATS} />
              </div>
              <div className="actions">
                <Button variant="primary" onClick={capture}>
                  Save this frame
                </Button>
                <Button variant="ghost" onClick={() => (setFile(null), setPreview(null))}>
                  Choose another video
                </Button>
              </div>
              <h2 className="field-label">Contact sheet</h2>
              <div className="form-grid">
                <TextField label="Columns" value={cols} onChange={setCols} inputMode="numeric" />
                <TextField label="Rows" value={rows} onChange={setRows} inputMode="numeric" />
                <TextField label="Sheet width (px)" value={sheetWidth} onChange={setSheetWidth} inputMode="numeric" />
              </div>
              <CheckboxField label="Show timestamps" checked={stamps} onChange={setStamps} />
              <div className="actions">
                <Button onClick={contactSheet} disabled={!!busy}>
                  Make contact sheet
                </Button>
              </div>
              {busy && <Status tone="info">{busy}</Status>}
              {preview && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={preview} alt="Contact sheet preview" style={{ width: '100%', borderRadius: 10 }} />
              )}
            </>
          )}
        </>
      )}
    </div>
  );
}
