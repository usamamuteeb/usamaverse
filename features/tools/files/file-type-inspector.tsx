'use client';

import { useRef, useState } from 'react';
import { Button } from '@/components/tool-kit/actions';
import { Status } from '@/components/tool-kit/fields';
import { ResultRows } from '@/components/tool-kit/output';
import { formatBytes } from '@/lib/format';
import { asciiPreview, detectSignature, extensionOf, hexDump, looksLikeText, type SignatureMatch } from './logic';

interface Report {
  name: string;
  size: number;
  browserType: string;
  ext: string;
  match: SignatureMatch | null;
  text: boolean;
  hex: string;
  ascii: string;
}

export default function FileTypeInspector() {
  const [reports, setReports] = useState<Report[]>([]);
  const [error, setError] = useState<string | null>(null);
  const ref = useRef<HTMLInputElement>(null);

  const inspect = async (files: FileList | File[]) => {
    setError(null);
    const list = Array.from(files).slice(0, 20);
    try {
      const out = await Promise.all(
        list.map(async (f) => {
          const head = new Uint8Array(await f.slice(0, 64).arrayBuffer());
          const sample = new Uint8Array(await f.slice(0, 4096).arrayBuffer());
          const match = detectSignature(head);
          return { name: f.name, size: f.size, browserType: f.type || '(none)', ext: extensionOf(f.name), match, text: !match && f.size > 0 && looksLikeText(sample), hex: hexDump(head, 32), ascii: asciiPreview(head, 32) };
        }),
      );
      setReports(out);
    } catch {
      setError('A file could not be read.');
    }
  };

  return (
    <div className="stack">
      <div
        className="dropzone"
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault();
          if (e.dataTransfer.files.length) void inspect(e.dataTransfer.files);
        }}
      >
        <p>Choose up to 20 files, or drop them here. Only the first bytes are read, on your device.</p>
        <div className="actions">
          <Button variant="primary" onClick={() => ref.current?.click()}>
            Choose files
          </Button>
          {reports.length > 0 && (
            <Button variant="ghost" onClick={() => setReports([])}>
              Reset
            </Button>
          )}
        </div>
        <input
          ref={ref}
          type="file"
          multiple
          className="visually-hidden-input"
          tabIndex={-1}
          aria-hidden="true"
          onChange={(e) => {
            if (e.target.files?.length) void inspect(e.target.files);
            e.target.value = '';
          }}
        />
      </div>
      {error && <Status tone="error">{error}</Status>}
      {reports.map((r, i) => {
        const extOk = r.match ? r.match.extensions.includes(r.ext) : null;
        return (
          <section key={i} className="card-plain" aria-label={`Report for ${r.name}`}>
            <h2 className="h3">{r.name}</h2>
            <ResultRows
              rows={[
                { label: 'Detected format', value: r.match ? `${r.match.label} (${r.match.mime})` : r.size === 0 ? 'Empty file' : r.text ? 'No binary signature — looks like plain UTF-8 text' : 'Unknown (no known signature)', emphasis: true },
                { label: 'Extension', value: r.ext ? `.${r.ext}` : '(none)' },
                { label: 'Browser-reported type', value: r.browserType },
                { label: 'Size', value: formatBytes(r.size) },
                { label: 'First 32 bytes (hex)', value: r.hex || '—' },
                { label: 'As text', value: r.ascii || '—' },
              ]}
            />
            {r.match?.note && <Status tone="info">{r.match.note}</Status>}
            {extOk === true && <Status tone="success">The extension matches the detected format.</Status>}
            {extOk === false && <Status tone="warn">The extension “.{r.ext || '(none)'}” does not match the detected format. Expected: {r.match!.extensions.filter(Boolean).map((e) => `.${e}`).join(', ')}.</Status>}
          </section>
        );
      })}
    </div>
  );
}
