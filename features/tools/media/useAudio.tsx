'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { encodeWav, type Pcm, type WavDepth } from './audio';
import { MAX_MEDIA_BYTES, decodeAudioFile, probeFile } from './browser';
import type { MediaInfo } from './probe';

export interface LoadedAudio {
  file: File;
  info: MediaInfo;
  pcm: Pcm;
}

/** Loads one file: probes its header, then decodes its audio. */
export function useAudioFile() {
  const [audio, setAudio] = useState<LoadedAudio | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const run = useRef(0);
  const load = useCallback(async (file: File) => {
    const id = ++run.current;
    setError(null);
    if (file.size > MAX_MEDIA_BYTES) {
      setError('Files over 1 GB are not supported in the browser.');
      return;
    }
    setBusy(true);
    try {
      const info = await probeFile(file);
      const pcm = await decodeAudioFile(file, info);
      if (id !== run.current) return;
      if (!pcm.channels[0]?.length) throw new Error('The file decoded to silence with no samples.');
      setAudio({ file, info, pcm });
    } catch (e) {
      if (id === run.current) {
        setAudio(null);
        setError((e as Error).message || 'This file could not be read.');
      }
    } finally {
      if (id === run.current) setBusy(false);
    }
  }, []);
  const reset = useCallback(() => {
    run.current++;
    setAudio(null);
    setError(null);
    setBusy(false);
  }, []);
  return { audio, busy, error, load, reset, setError };
}

/** WAV blob + object URL for previewing and downloading a result. */
export function useWavResult(pcm: Pcm | null, depth: WavDepth = 16) {
  const blob = useMemo(() => (pcm && pcm.channels[0]?.length ? new Blob([encodeWav(pcm, depth) as Uint8Array<ArrayBuffer>], { type: 'audio/wav' }) : null), [pcm, depth]);
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    if (!blob) {
      setUrl(null);
      return;
    }
    const u = URL.createObjectURL(blob);
    setUrl(u);
    return () => URL.revokeObjectURL(u);
  }, [blob]);
  return { blob, url };
}

export const DEPTH_CHOICES = [
  { value: '16', label: '16-bit PCM (CD quality, smallest)' },
  { value: '24', label: '24-bit PCM (studio)' },
  { value: '32', label: '32-bit float (no clipping)' },
];
