'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';
import { formatBytes } from '@/lib/format';
import { Button } from './actions';

/** Accessible file chooser: a real button + hidden native input, with optional drag & drop. */
export function FileDrop({
  accept,
  multiple = false,
  onFiles,
  label = 'Choose file',
  children,
}: {
  accept?: string;
  multiple?: boolean;
  onFiles: (files: File[]) => void;
  label?: string;
  children?: ReactNode;
}) {
  const ref = useRef<HTMLInputElement>(null);
  const [over, setOver] = useState(false);
  return (
    <div
      className={over ? 'dropzone is-over' : 'dropzone'}
      onDragOver={(e) => {
        e.preventDefault();
        setOver(true);
      }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setOver(false);
        const list = Array.from<File>(e.dataTransfer.files ?? []);
        if (list.length) onFiles(multiple ? list : list.slice(0, 1));
      }}
    >
      {children ?? <p>Choose {multiple ? 'files' : 'a file'} or drop {multiple ? 'them' : 'it'} here. Nothing is uploaded.</p>}
      <Button variant="primary" onClick={() => ref.current?.click()}>
        {label}
      </Button>
      <input
        ref={ref}
        type="file"
        accept={accept}
        multiple={multiple}
        className="visually-hidden-input"
        tabIndex={-1}
        aria-hidden="true"
        onChange={(e) => {
          const list = Array.from<File>(e.target.files ?? []);
          e.target.value = '';
          if (list.length) onFiles(list);
        }}
      />
    </div>
  );
}

export interface OrderedItem {
  id: number;
  name: string;
  size: number;
  note?: string;
}

/** Ordered list with move up/down/remove buttons (keyboard accessible). */
export function OrderedFileList<T extends OrderedItem>({ items, onChange, label = 'Files in order' }: { items: T[]; onChange: (items: T[]) => void; label?: string }) {
  const move = (i: number, d: -1 | 1) => {
    const j = i + d;
    if (j < 0 || j >= items.length) return;
    const a = items.slice();
    [a[i], a[j]] = [a[j], a[i]];
    onChange(a);
  };
  if (!items.length) return null;
  return (
    <ol className="file-list" aria-label={label}>
      {items.map((it, i) => (
        <li key={it.id}>
          <span className="file-name">{it.name}</span>
          <span className="muted">
            {formatBytes(it.size)}
            {it.note ? ` · ${it.note}` : ''}
          </span>
          <span className="actions tight">
            <Button variant="ghost" onClick={() => move(i, -1)} disabled={i === 0} ariaLabel={`Move ${it.name} up`}>
              ↑
            </Button>
            <Button variant="ghost" onClick={() => move(i, 1)} disabled={i === items.length - 1} ariaLabel={`Move ${it.name} down`}>
              ↓
            </Button>
            <Button variant="ghost" onClick={() => onChange(items.filter((x) => x.id !== it.id))} ariaLabel={`Remove ${it.name}`}>
              ✕
            </Button>
          </span>
        </li>
      ))}
    </ol>
  );
}

/** Object URL for a Blob that is revoked when the blob changes or the component unmounts. */
export function useObjectUrl(blob: Blob | null): string | null {
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
  return url;
}

let counter = 1;
export const nextId = () => counter++;

export async function readBytes(f: File): Promise<Uint8Array> {
  return new Uint8Array(await f.arrayBuffer());
}
