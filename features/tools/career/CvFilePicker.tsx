'use client';

import { useRef, useState } from 'react';
import type { CvInputFormat } from './cv-convert';
import { CV_FILE_ACCEPT, readCvFile } from './cv-import';

/** Button that opens a CV file (PDF, Word, LaTeX, Markdown, text or JSON) and returns its text. */
export function CvFilePicker({ onText, onError, label = 'Open file', accept = CV_FILE_ACCEPT }: { onText: (text: string, format: CvInputFormat, note?: string) => void; onError: (m: string) => void; label?: string; accept?: string }) {
  const ref = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  return (
    <>
      <button type="button" className="btn btn-secondary" onClick={() => ref.current?.click()} disabled={busy}>
        {busy ? 'Reading…' : label}
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
          setBusy(true);
          try {
            const r = await readCvFile(f);
            onText(r.text, r.format, r.note);
          } catch (err) {
            onError(err instanceof Error ? err.message : String(err));
          } finally {
            setBusy(false);
          }
        }}
      />
    </>
  );
}
