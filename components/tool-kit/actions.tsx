'use client';

import { useEffect, useRef, useState, type ReactNode, type RefObject } from 'react';
import { copyText, selectContents } from '@/lib/tools/shared/clipboard';
import { downloadBlob, downloadText } from '@/lib/tools/shared/download';

export function Button({
  children,
  onClick,
  variant = 'secondary',
  disabled,
  type = 'button',
  ariaLabel,
}: {
  children: ReactNode;
  onClick?: () => void;
  variant?: 'primary' | 'secondary' | 'ghost';
  disabled?: boolean;
  type?: 'button' | 'submit';
  ariaLabel?: string;
}) {
  return (
    <button type={type} className={`btn btn-${variant}`} onClick={onClick} disabled={disabled} aria-label={ariaLabel}>
      {children}
    </button>
  );
}

export function CopyButton({ text, targetRef, label = 'Copy' }: { text: string; targetRef?: RefObject<HTMLElement | null>; label?: string }) {
  const [state, setState] = useState<'idle' | 'copied' | 'manual'>('idle');
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
  }, []);
  const onCopy = async () => {
    const ok = await copyText(text);
    if (!ok) selectContents(targetRef?.current ?? null);
    setState(ok ? 'copied' : 'manual');
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setState('idle'), 2500);
  };
  return (
    <>
      <button type="button" className="btn btn-secondary" onClick={onCopy} disabled={!text}>
        {state === 'copied' ? 'Copied ✓' : label}
      </button>
      <span className="sr-only" aria-live="polite">
        {state === 'copied' ? 'Copied to clipboard.' : state === 'manual' ? 'Copy was blocked. The text is selected; press Control or Command plus C.' : ''}
      </span>
      {state === 'manual' && <span className="inline-note">Text selected — press Ctrl/⌘ + C</span>}
    </>
  );
}

export function DownloadTextButton({ text, filename, mime = 'text/plain', label = 'Download' }: { text: string; filename: string; mime?: string; label?: string }) {
  return (
    <button type="button" className="btn btn-secondary" disabled={!text} onClick={() => downloadText(text, filename, mime)}>
      {label}
    </button>
  );
}

export function DownloadBlobButton({ blob, filename, label = 'Download' }: { blob: Blob | null; filename: string; label?: string }) {
  return (
    <button type="button" className="btn btn-primary" disabled={!blob} onClick={() => blob && downloadBlob(blob, filename)}>
      {label}
    </button>
  );
}

/** Button that opens the native file picker and reads one text file. */
export function OpenTextFileButton({ onText, onError, maxBytes = 10 * 1024 * 1024, accept = '.txt,.csv,.tsv,.json,.xml,.md,.html,.log,text/*', label = 'Open file' }: { onText: (text: string, name: string) => void; onError: (msg: string) => void; maxBytes?: number; accept?: string; label?: string }) {
  const ref = useRef<HTMLInputElement>(null);
  return (
    <>
      <button type="button" className="btn btn-ghost" onClick={() => ref.current?.click()}>
        {label}
      </button>
      <input
        ref={ref}
        type="file"
        accept={accept}
        className="visually-hidden-input"
        tabIndex={-1}
        aria-hidden="true"
        onChange={async (e) => {
          const f = e.target.files?.[0];
          e.target.value = '';
          if (!f) return;
          if (f.size > maxBytes) {
            onError(`That file is ${(f.size / 1e6).toFixed(1)} MB; the limit here is ${(maxBytes / 1e6).toFixed(0)} MB.`);
            return;
          }
          try {
            onText(await f.text(), f.name);
          } catch {
            onError('The file could not be read as text.');
          }
        }}
      />
    </>
  );
}
