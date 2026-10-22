'use client';

import { useState } from 'react';
import type { CiteStyle } from './bib';

export const CITE_STYLES: Array<{ value: CiteStyle; label: string }> = [
  { value: 'apa', label: 'APA 7th' },
  { value: 'mla', label: 'MLA 9th' },
  { value: 'chicago', label: 'Chicago (author–date)' },
  { value: 'harvard', label: 'Harvard' },
  { value: 'ieee', label: 'IEEE' },
];

/** Copies HTML (keeps italics when pasted into Word / Google Docs) with a plain-text fallback. */
export function RichCopyButton({ html, text, disabled, label = 'Copy with formatting' }: { html: string; text: string; disabled?: boolean; label?: string }) {
  const [done, setDone] = useState<'' | 'ok' | 'plain'>('');
  return (
    <>
      <button
        type="button"
        className="btn btn-primary"
        disabled={disabled}
        onClick={async () => {
          try {
            if (typeof ClipboardItem !== 'undefined' && navigator.clipboard?.write) {
              await navigator.clipboard.write([new ClipboardItem({ 'text/html': new Blob([html], { type: 'text/html' }), 'text/plain': new Blob([text], { type: 'text/plain' }) })]);
              setDone('ok');
            } else {
              await navigator.clipboard.writeText(text);
              setDone('plain');
            }
          } catch {
            setDone('plain');
          }
          setTimeout(() => setDone(''), 2500);
        }}
      >
        {done === 'ok' ? 'Copied ✓' : label}
      </button>
      <span className="sr-only" aria-live="polite">
        {done === 'ok' ? 'Copied with formatting.' : done === 'plain' ? 'Formatting could not be copied; use the plain-text button.' : ''}
      </span>
      {done === 'plain' && <span className="inline-note">Formatted copy is blocked here — try “Copy as plain text”.</span>}
    </>
  );
}
