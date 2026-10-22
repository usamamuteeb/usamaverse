'use client';

import { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/tool-kit/actions';
import { RangeField, SelectField, Status } from '@/components/tool-kit/fields';
import { FileDrop } from '@/components/tool-kit/files';
import { formatBytes } from '@/lib/format';
import { downloadBlob } from '@/lib/tools/shared/download';
import { canvasToBlob } from '@/features/tools/image/useImage';
import { createZip, type ZipInput } from '@/features/tools/files/zip';
import { DISPOSAL, decodeGif, playDelay, type Gif } from './gif';
import { baseName } from './browser';

const MAX_THUMBS = 240;

function paint(c: HTMLCanvasElement | null, gif: Gif, i: number) {
  if (!c) return;
  c.width = gif.width;
  c.height = gif.height;
  const f = gif.frames[i];
  c.getContext('2d')!.putImageData(new ImageData(f.rgba, gif.width, gif.height), 0, 0);
}

function frameCanvas(gif: Gif, i: number): HTMLCanvasElement {
  const c = document.createElement('canvas');
  paint(c, gif, i);
  return c;
}

export default function GifFrameInspector() {
  const [file, setFile] = useState<File | null>(null);
  const [gif, setGif] = useState<Gif | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [cur, setCur] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(1);
  const [bg, setBg] = useState('checker');
  const [busy, setBusy] = useState<string | null>(null);
  const stage = useRef<HTMLCanvasElement>(null);
  const thumbs = useRef<Array<HTMLCanvasElement | null>>([]);

  const load = async (f: File) => {
    setError(null);
    setGif(null);
    setPlaying(false);
    if (f.size > 100 * 1024 * 1024) return setError('GIFs over 100 MB are not supported.');
    setFile(f);
    setBusy('Decoding frames…');
    try {
      await new Promise((r) => setTimeout(r, 30));
      const g = decodeGif(new Uint8Array(await f.arrayBuffer()));
      setGif(g);
      setCur(0);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(null);
    }
  };

  useEffect(() => {
    if (gif) paint(stage.current, gif, cur);
  }, [gif, cur]);

  useEffect(() => {
    if (!gif) return;
    gif.frames.slice(0, MAX_THUMBS).forEach((_, i) => paint(thumbs.current[i] ?? null, gif, i));
  }, [gif]);

  useEffect(() => {
    if (!playing || !gif || gif.frames.length < 2) return;
    const t = setTimeout(() => setCur((c) => (c + 1) % gif.frames.length), playDelay(gif.frames[cur].delay) / speed);
    return () => clearTimeout(t);
  }, [playing, cur, gif, speed]);

  const saveFrame = async () => {
    if (!gif || !file) return;
    downloadBlob(await canvasToBlob(frameCanvas(gif, cur), 'image/png'), `${baseName(file.name)}-frame-${String(cur + 1).padStart(3, '0')}.png`);
  };

  const saveAll = async () => {
    if (!gif || !file) return;
    try {
      const files: ZipInput[] = [];
      for (let i = 0; i < gif.frames.length; i++) {
        setBusy(`Encoding frame ${i + 1} of ${gif.frames.length}…`);
        const blob = await canvasToBlob(frameCanvas(gif, i), 'image/png');
        files.push({ name: `frame-${String(i + 1).padStart(String(gif.frames.length).length, '0')}-${gif.frames[i].delay}ms.png`, data: new Uint8Array(await blob.arrayBuffer()) });
      }
      setBusy('Creating ZIP…');
      const zip = await createZip(files, { compress: false });
      downloadBlob(new Blob([zip.bytes as Uint8Array<ArrayBuffer>], { type: 'application/zip' }), `${baseName(file.name)}-frames.zip`);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(null);
    }
  };

  const f = gif?.frames[cur];
  const delays = gif ? new Set(gif.frames.map((x) => x.delay)) : null;

  return (
    <div className="stack">
      <FileDrop accept="image/gif,.gif" onFiles={(fs) => load(fs[0])} label="Choose GIF">
        <p>Choose an animated GIF to step through its frames, check delays and save frames as PNG. Nothing is uploaded.</p>
      </FileDrop>
      {busy && <Status tone="info">{busy}</Status>}
      {error && <Status tone="error">{error}</Status>}
      {gif && file && f && (
        <>
          <dl className="stat-grid">
            <div className="stat">
              <dt>Size</dt>
              <dd>
                {gif.width} × {gif.height}
              </dd>
            </div>
            <div className="stat">
              <dt>Frames</dt>
              <dd>{gif.frames.length}</dd>
            </div>
            <div className="stat">
              <dt>Duration</dt>
              <dd>{(gif.duration / 1000).toFixed(2)} s</dd>
            </div>
            <div className="stat">
              <dt>Loops</dt>
              <dd>{gif.loops === null ? 'Once' : gif.loops === 0 ? 'Forever' : `${gif.loops}×`}</dd>
            </div>
            <div className="stat">
              <dt>File</dt>
              <dd>{formatBytes(file.size)}</dd>
            </div>
          </dl>
          {gif.frames.some((x) => x.delay <= 10) && gif.frames.length > 1 && <Status tone="info">Some frames have a delay of 0–10 ms; browsers show those for about 100 ms, which is how the duration above is counted.</Status>}
          <div className="tool-grid">
            <div className="tool-col">
              <div className={`gif-stage ${bg === 'checker' ? 'checker' : ''}`} style={bg === 'checker' ? undefined : { background: bg }}>
                <canvas ref={stage} aria-label={`Frame ${cur + 1} of ${gif.frames.length}`} role="img" style={{ width: Math.min(560, Math.max(gif.width, Math.min(320, gif.width * 8))) }} />
              </div>
              <div className="actions">
                <Button variant="ghost" onClick={() => setCur((c) => (c - 1 + gif.frames.length) % gif.frames.length)} ariaLabel="Previous frame">
                  ◀
                </Button>
                <Button variant="primary" onClick={() => setPlaying((p) => !p)} disabled={gif.frames.length < 2}>
                  {playing ? 'Pause' : 'Play'}
                </Button>
                <Button variant="ghost" onClick={() => setCur((c) => (c + 1) % gif.frames.length)} ariaLabel="Next frame">
                  ▶
                </Button>
                <span className="muted">
                  Frame {cur + 1} / {gif.frames.length}
                </span>
              </div>
            </div>
            <div className="tool-col">
              <div className="table-scroll">
                <table className="data-table compact">
                  <caption>Frame {cur + 1}</caption>
                  <tbody>
                    <tr>
                      <th scope="row">Delay</th>
                      <td>
                        {f.delay} ms{f.delay <= 10 ? ' (shown as ~100 ms)' : ''}
                      </td>
                    </tr>
                    <tr>
                      <th scope="row">Area</th>
                      <td>
                        {f.width} × {f.height} at ({f.left}, {f.top})
                      </td>
                    </tr>
                    <tr>
                      <th scope="row">Disposal</th>
                      <td>{DISPOSAL[f.disposal] ?? `Method ${f.disposal}`}</td>
                    </tr>
                    <tr>
                      <th scope="row">Transparency</th>
                      <td>{f.transparentIndex === null ? 'None' : `Colour index ${f.transparentIndex}`}</td>
                    </tr>
                    <tr>
                      <th scope="row">Palette</th>
                      <td>{f.localPalette ? 'Own (local) palette' : 'Global palette'}</td>
                    </tr>
                    <tr>
                      <th scope="row">Interlaced</th>
                      <td>{f.interlaced ? 'Yes' : 'No'}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
              <RangeField label="Playback speed" value={speed} onChange={setSpeed} min={0.25} max={4} step={0.25} format={(v) => `${v}×`} />
              <SelectField label="Background" value={bg} onChange={setBg} options={[{ value: 'checker', label: 'Checkerboard' }, { value: '#ffffff', label: 'White' }, { value: '#000000', label: 'Black' }]} />
              <div className="actions">
                <Button onClick={saveFrame}>Save frame as PNG</Button>
                <Button onClick={saveAll} disabled={!!busy}>
                  Save all frames (.zip)
                </Button>
              </div>
              <p className="field-hint">
                GIF{gif.version} · {gif.globalPalette ? 'global palette' : 'no global palette'} · {delays && delays.size === 1 ? `every frame ${[...delays][0]} ms` : 'mixed delays'}
                {gif.comments.length ? ` · comment: “${gif.comments.join(' ').slice(0, 120)}”` : ''}
              </p>
            </div>
          </div>
          {gif.frames.length > 1 && (
            <>
              <h2 className="field-label">All frames</h2>
              <ol className="gif-frames">
                {gif.frames.slice(0, MAX_THUMBS).map((fr, i) => (
                  <li key={i} className={i === cur ? 'is-current' : ''}>
                    <button type="button" onClick={() => (setPlaying(false), setCur(i))} aria-label={`Show frame ${i + 1}, ${fr.delay} ms`}>
                      <canvas ref={(el) => void (thumbs.current[i] = el)} className="checker" />
                      <span>
                        #{i + 1} · {fr.delay} ms
                      </span>
                    </button>
                  </li>
                ))}
              </ol>
              {gif.frames.length > MAX_THUMBS && <p className="field-hint">Showing the first {MAX_THUMBS} of {gif.frames.length} frames; use ◀ ▶ to reach the rest.</p>}
            </>
          )}
        </>
      )}
    </div>
  );
}
