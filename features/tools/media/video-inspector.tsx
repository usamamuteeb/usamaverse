'use client';

import { useState } from 'react';
import { Button } from '@/components/tool-kit/actions';
import { Status } from '@/components/tool-kit/fields';
import { FileDrop, useObjectUrl } from '@/components/tool-kit/files';
import { formatTime } from './audio';
import { MAX_MEDIA_BYTES, probeFile } from './browser';
import { MediaInfoTable } from './MediaInfoTable';
import type { MediaInfo } from './probe';

export default function VideoInspector() {
  const [file, setFile] = useState<File | null>(null);
  const [info, setInfo] = useState<MediaInfo | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [el, setEl] = useState<{ w: number; h: number; d: number } | null>(null);
  const [playable, setPlayable] = useState<boolean | null>(null);
  const url = useObjectUrl(file);

  const load = async (f: File) => {
    setError(null);
    setInfo(null);
    setEl(null);
    setPlayable(null);
    if (f.size > MAX_MEDIA_BYTES * 4) return setError('Files over 4 GB are not supported.');
    setFile(f);
    try {
      setInfo(await probeFile(f));
    } catch (e) {
      setError((e as Error).message);
    }
  };

  return (
    <div className="stack">
      <FileDrop accept="video/*,audio/*,.mp4,.m4v,.mov,.webm,.mkv,.avi,.ogv,.3gp" onFiles={(f) => load(f[0])} label="Choose video">
        <p>Choose a video to see its codec, resolution, frame rate, bitrate and tracks. Only the file’s header is read; nothing is uploaded.</p>
      </FileDrop>
      {error && <Status tone="error">{error}</Status>}
      {file && info && (
        <div className="tool-grid">
          <div className="tool-col">
            <MediaInfoTable
              info={info}
              file={file}
              extra={[
                ['Plays in this browser', playable === null ? 'checking…' : playable ? 'Yes' : 'No — the codec or container is not supported here'],
                ['Browser reports', el ? `${el.w} × ${el.h}${Number.isFinite(el.d) ? `, ${formatTime(el.d, 3)}` : ''}` : undefined],
              ]}
            />
          </div>
          <div className="tool-col">
            {url && (
              <video
                className="media-player"
                controls
                preload="metadata"
                src={url}
                onLoadedMetadata={(e) => {
                  const v = e.currentTarget;
                  setEl({ w: v.videoWidth, h: v.videoHeight, d: v.duration });
                  setPlayable(true);
                }}
                onError={() => setPlayable(false)}
                style={{ width: '100%', maxHeight: 360, background: '#000', borderRadius: 10 }}
              />
            )}
            <div className="actions">
              <Button variant="ghost" onClick={() => (setFile(null), setInfo(null))}>
                Clear
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
