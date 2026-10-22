'use client';

import { useEffect, useRef, useState } from 'react';
import type { FFmpeg } from '@ffmpeg/ffmpeg';
import { Button, DownloadBlobButton } from '@/components/tool-kit/actions';
import { SelectField, Status, TextField } from '@/components/tool-kit/fields';
import { FileDrop, useObjectUrl } from '@/components/tool-kit/files';
import { formatBytes } from '@/lib/format';
import { MEDIA_MIME, mediaCommand, type MediaFormat, type VideoAction } from './transcode';

type WrapperWindow = Window & { FFmpegWASM?: { FFmpeg: new () => FFmpeg } };
let wrapperPromise: Promise<new () => FFmpeg> | null = null;
function loadWrapper(): Promise<new () => FFmpeg> {
  if (wrapperPromise) return wrapperPromise;
  const pending: Promise<new () => FFmpeg> = new Promise<new () => FFmpeg>((resolve, reject) => {
    const win = window as WrapperWindow;
    if (win.FFmpegWASM) { resolve(win.FFmpegWASM.FFmpeg); return; }
    const script = document.createElement('script');
    script.src = '/ffmpeg/ffmpeg.js';
    script.async = true;
    script.onload = () => win.FFmpegWASM ? resolve(win.FFmpegWASM.FFmpeg) : reject(new Error('Video engine wrapper did not initialize.'));
    script.onerror = () => reject(new Error('Could not load the local video engine.'));
    document.head.appendChild(script);
  }).catch((error: unknown) => { wrapperPromise = null; throw error; });
  wrapperPromise = pending;
  return pending;
}

const formats: Array<{ value: MediaFormat; label: string }> = [
  { value: 'mp4', label: 'MP4 video (H.264/AAC)' }, { value: 'webm', label: 'WebM video (VP8/Opus)' },
  { value: 'gif', label: 'Animated GIF (480px, 10 fps)' }, { value: 'mp3', label: 'MP3 audio' }, { value: 'wav', label: 'WAV audio' },
];

export default function VideoStudio({ action }: { action: VideoAction }) {
  const [file, setFile] = useState<File | null>(null);
  const [start, setStart] = useState('0');
  const [end, setEnd] = useState('5');
  const [duration, setDuration] = useState(0);
  const [format, setFormat] = useState<MediaFormat>('mp4');
  const [output, setOutput] = useState<Blob | null>(null);
  const [outputName, setOutputName] = useState('');
  const [busy, setBusy] = useState(false);
  const [phase, setPhase] = useState('');
  const [error, setError] = useState('');
  const engine = useRef<FFmpeg | null>(null);
  const task = useRef(0);
  const inputUrl = useObjectUrl(file);
  const outputUrl = useObjectUrl(output);
  useEffect(() => () => { engine.current?.terminate(); }, []);
  const target: MediaFormat = action === 'convert' ? format : 'mp4';
  const run = async () => {
    if (!file || busy) return;
    const id = ++task.current;
    setError(''); setOutput(null); setBusy(true);
    const ext = file.name.match(/\.([a-z0-9]{2,5})$/i)?.[1]?.toLowerCase() || 'bin';
    const input = `input.${ext}`;
    const out = `result.${target}`;
    try {
      if (file.size > 100 * 1024 * 1024) throw new Error('Choose a file under 100 MB for browser processing.');
      const args = mediaCommand(action, input, out, { start: Number(start), end: Number(end), format: target });
      setPhase('Loading local video engine (about 32 MB on first use)…');
      const FFmpegClass = await loadWrapper();
      if (id !== task.current) return;
      const ffmpeg = new FFmpegClass(); engine.current = ffmpeg;
      ffmpeg.on('progress', ({ progress }) => { if (id === task.current) setPhase(`Processing: ${Math.min(99, Math.max(0, Math.round(progress * 100)))}%`); });
      await ffmpeg.load({ coreURL: `${location.origin}/ffmpeg/ffmpeg-core.js`, wasmURL: `${location.origin}/ffmpeg/ffmpeg-core.wasm` });
      if (id !== task.current) return;
      setPhase('Processing locally…');
      await ffmpeg.writeFile(input, new Uint8Array(await file.arrayBuffer()));
      if (id !== task.current) return;
      const code = await ffmpeg.exec(args, 600_000);
      if (id !== task.current) return;
      if (code !== 0) throw new Error(`The video engine could not process this file (exit code ${code}). Try a browser-playable MP4 or WebM.`);
      const result = await ffmpeg.readFile(out);
      if (id !== task.current) return;
      if (!(result instanceof Uint8Array) || !result.length) throw new Error('The video engine produced an empty file.');
      const blob = new Blob([result as BlobPart], { type: MEDIA_MIME[target] });
      setOutput(blob);
      setOutputName(`${file.name.replace(/\.[^.]+$/, '')}-${action}.${target}`);
      setPhase(`Ready · ${formatBytes(blob.size)}`);
    } catch (e) { if (id === task.current) { setError(e instanceof Error ? e.message : String(e)); setPhase(''); } }
    finally { if (id === task.current) { engine.current?.terminate(); engine.current = null; setBusy(false); } }
  };
  return <div className="tool-grid">
    <div className="tool-col">
      <FileDrop accept={action === 'convert' ? 'video/*,audio/*,.mov,.mkv,.avi,.m4a' : 'video/*,.mov,.mkv,.avi'} label={action === 'convert' ? 'Choose a video or audio file' : 'Choose a video file'} onFiles={(files) => { setFile(files[0]); setOutput(null); setError(''); setDuration(0); }} />
      {file && <p className="summary">{file.name} · {formatBytes(file.size)}</p>}
      {file && inputUrl && <video className="video-preview" src={inputUrl} controls preload="metadata" onLoadedMetadata={(e) => { const d = e.currentTarget.duration; if (Number.isFinite(d)) { setDuration(d); setEnd(String(Math.min(d, 5).toFixed(2))); } }} />}
      {action === 'trim' && <><div className="field-row"><TextField label="Start (seconds)" value={start} onChange={setStart} type="number" min={0} step="0.01" /><TextField label="End (seconds)" value={end} onChange={setEnd} type="number" min={0} step="0.01" /></div><p className="field-hint">{duration ? `Source duration ${duration.toFixed(2)} seconds. ` : ''}Trim is re-encoded for an accurate cut.</p></>}
      {action === 'convert' && <SelectField label="Output format" value={format} onChange={(v) => setFormat(v as MediaFormat)} options={formats} />}
      <div className="actions"><Button variant="primary" disabled={!file || busy} onClick={run}>{busy ? 'Processing…' : action === 'trim' ? 'Trim video' : action === 'mute' ? 'Remove audio' : 'Convert media'}</Button>{busy && <Button variant="ghost" onClick={() => { task.current++; engine.current?.terminate(); engine.current = null; setBusy(false); setPhase('Cancelled.'); }}>Cancel</Button>}</div>
      <p className="field-hint">Processing happens on this device. The 32 MB codec engine loads only when you start. A 100 MB input and 10-minute run limit protect browser memory; longer videos may need a desktop editor.</p>
    </div>
    <div className="tool-col">
      {phase && <Status tone="info">{phase}</Status>}
      {error && <Status tone="error">{error}</Status>}
      {output && <><DownloadBlobButton blob={output} filename={outputName} label={`Download ${target.toUpperCase()}`} />{outputUrl && (target === 'mp4' || target === 'webm' ? <video className="video-preview" src={outputUrl} controls /> : target === 'gif' ? <img className="video-preview" src={outputUrl} alt="Converted animation" /> : <audio src={outputUrl} controls />)}</>}
    </div>
  </div>;
}
