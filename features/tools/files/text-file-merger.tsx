'use client';

import { useMemo, useRef, useState } from 'react';
import { Button, CopyButton, DownloadBlobButton } from '@/components/tool-kit/actions';
import { SelectField, Status, TextField } from '@/components/tool-kit/fields';
import { formatBytes } from '@/lib/format';
import { looksLikeText } from './logic';

const MAX_FILES = 50;
const MAX_TOTAL = 20 * 1024 * 1024;

interface Item {
  id: number;
  name: string;
  text: string;
  size: number;
}

let nextId = 1;

export default function TextFileMerger() {
  const [items, setItems] = useState<Item[]>([]);
  const [sep, setSep] = useState<'newline' | 'blank' | 'header' | 'none'>('newline');
  const [outName, setOutName] = useState('merged.txt');
  const [error, setError] = useState<string | null>(null);
  const ref = useRef<HTMLInputElement>(null);

  const add = async (files: FileList) => {
    setError(null);
    const incoming = Array.from(files);
    const total = items.reduce((n, i) => n + i.size, 0) + incoming.reduce((n, f) => n + f.size, 0);
    if (items.length + incoming.length > MAX_FILES) return setError(`Up to ${MAX_FILES} files can be merged at once.`);
    if (total > MAX_TOTAL) return setError(`Total size would be ${formatBytes(total)}; the limit is ${formatBytes(MAX_TOTAL)}.`);
    const added: Item[] = [];
    const rejected: string[] = [];
    for (const f of incoming) {
      const sample = new Uint8Array(await f.slice(0, 8192).arrayBuffer());
      if (f.size > 0 && !looksLikeText(sample)) {
        rejected.push(f.name);
        continue;
      }
      added.push({ id: nextId++, name: f.name, text: (await f.text()).replace(/^﻿/, ''), size: f.size });
    }
    setItems((p) => [...p, ...added]);
    if (rejected.length) setError(`Skipped ${rejected.length} file(s) that are not UTF-8 text: ${rejected.slice(0, 5).join(', ')}${rejected.length > 5 ? '…' : ''}`);
  };

  const move = (idx: number, d: -1 | 1) =>
    setItems((p) => {
      const a = p.slice();
      const j = idx + d;
      if (j < 0 || j >= a.length) return p;
      [a[idx], a[j]] = [a[j], a[idx]];
      return a;
    });

  const merged = useMemo(() => {
    const join = { newline: '\n', blank: '\n\n', header: '\n\n', none: '' }[sep];
    return items
      .map((it) => {
        const body = it.text.replace(/\r?\n$/, '');
        return sep === 'header' ? `===== ${it.name} =====\n${body}` : body;
      })
      .join(join);
  }, [items, sep]);

  const blob = useMemo(() => (items.length ? new Blob([merged], { type: 'text/plain;charset=utf-8' }) : null), [merged, items.length]);
  const safeName = (outName.trim() || 'merged.txt').replace(/[\\/:*?"<>|]+/g, '_');

  return (
    <div className="tool-grid">
      <div className="tool-col">
        <div className="actions">
          <Button variant="primary" onClick={() => ref.current?.click()}>
            Add text files
          </Button>
          {items.length > 0 && (
            <Button variant="ghost" onClick={() => setItems([])}>
              Reset
            </Button>
          )}
        </div>
        <input
          ref={ref}
          type="file"
          multiple
          accept=".txt,.csv,.tsv,.md,.log,.json,.xml,.html,.css,.js,.ts,text/*"
          className="visually-hidden-input"
          tabIndex={-1}
          aria-hidden="true"
          onChange={(e) => {
            if (e.target.files?.length) void add(e.target.files);
            e.target.value = '';
          }}
        />
        {error && <Status tone="warn">{error}</Status>}
        {items.length > 0 && (
          <ol className="file-list" aria-label="Files in merge order">
            {items.map((it, i) => (
              <li key={it.id}>
                <span className="file-name">{it.name}</span>
                <span className="muted">{formatBytes(it.size)}</span>
                <span className="actions tight">
                  <Button variant="ghost" onClick={() => move(i, -1)} disabled={i === 0} ariaLabel={`Move ${it.name} up`}>
                    ↑
                  </Button>
                  <Button variant="ghost" onClick={() => move(i, 1)} disabled={i === items.length - 1} ariaLabel={`Move ${it.name} down`}>
                    ↓
                  </Button>
                  <Button variant="ghost" onClick={() => setItems((p) => p.filter((x) => x.id !== it.id))} ariaLabel={`Remove ${it.name}`}>
                    ✕
                  </Button>
                </span>
              </li>
            ))}
          </ol>
        )}
        <SelectField label="Between files" value={sep} onChange={(v) => setSep(v as 'newline')} options={[{ value: 'newline', label: 'New line' }, { value: 'blank', label: 'Blank line' }, { value: 'header', label: 'Blank line + file name header' }, { value: 'none', label: 'Nothing (join directly)' }]} />
        <TextField label="Output file name" value={outName} onChange={setOutName} />
      </div>
      <div className="tool-col">
        {items.length === 0 ? (
          <p className="empty-state">Add two or more text files to merge them.</p>
        ) : (
          <>
            <p className="summary">
              {items.length} file{items.length === 1 ? '' : 's'}, {merged.length.toLocaleString()} characters.
            </p>
            <pre className="code-block preview-text">{merged.slice(0, 20000)}{merged.length > 20000 ? '\n… (preview truncated; the download contains everything)' : ''}</pre>
            <div className="actions">
              <DownloadBlobButton blob={blob} filename={safeName} label="Download merged file" />
              <CopyButton text={merged} />
            </div>
          </>
        )}
      </div>
    </div>
  );
}
