'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useId, useMemo, useRef, useState, type KeyboardEvent } from 'react';
import { editorPicks, getPublicTool, publicSearchItems, type SearchItem } from '@/lib/tools/public';
import { buildIndex, search } from '@/lib/tools/search';
import { useRecent } from '@/lib/local-store';

const index = buildIndex(publicSearchItems);
const MAX = 12;

export default function SearchDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [q, setQ] = useState('');
  const [active, setActive] = useState(0);
  const router = useRouter();
  const listId = useId();
  const { recent } = useRecent();

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) {
      d.showModal();
      setActive(0);
      requestAnimationFrame(() => {
        inputRef.current?.focus();
        inputRef.current?.select();
      });
    } else if (!open && d.open) d.close();
  }, [open]);

  const results: SearchItem[] = useMemo(() => {
    if (q.trim()) return search(index, q, MAX);
    const recentItems = recent.map((s) => publicSearchItems.find((i) => i.slug === s)).filter((x): x is SearchItem => Boolean(x));
    const picks = editorPicks.map((s) => publicSearchItems.find((i) => i.slug === s)!).filter((p) => !recent.includes(p.slug));
    return [...recentItems.slice(0, 5), ...picks].slice(0, MAX);
  }, [q, recent]);

  const go = (slug: string) => {
    onClose();
    router.push(`/tools/${slug}`);
  };

  const onKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Escape') {
      // type="search" would otherwise swallow the first Escape to clear itself.
      e.preventDefault();
      onClose();
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActive((a) => (results.length ? (a + 1) % results.length : 0));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActive((a) => (results.length ? (a - 1 + results.length) % results.length : 0));
    } else if (e.key === 'Enter' && results[active]) {
      e.preventDefault();
      go(results[active].slug);
    }
  };

  const heading = q.trim() ? (results.length ? 'Results' : '') : recent.length ? 'Recent and suggested' : 'Suggested';

  return (
    <dialog
      ref={ref}
      className="search-dialog"
      aria-label="Search tools"
      onClose={onClose}
      onClick={(e) => {
        if (e.target === ref.current) onClose(); // backdrop click
      }}
    >
      <div className="search-box">
        <label htmlFor="global-search" className="sr-only">
          Search tools
        </label>
        <input
          id="global-search"
          ref={inputRef}
          className="search-input"
          type="search"
          role="combobox"
          aria-expanded={results.length > 0}
          aria-controls={listId}
          aria-activedescendant={results[active] ? `${listId}-${active}` : undefined}
          aria-autocomplete="list"
          placeholder="Search tools — try “json”, “kg to lb”, “compress”"
          autoComplete="off"
          spellCheck={false}
          value={q}
          onChange={(e) => {
            setQ(e.target.value);
            setActive(0);
          }}
          onKeyDown={onKeyDown}
        />
        <button type="button" className="btn btn-ghost" onClick={onClose}>
          Close <span className="sr-only">search</span>
          <kbd className="hide-sm">Esc</kbd>
        </button>
      </div>
      {heading && <p className="search-heading">{heading}</p>}
      <ul id={listId} role="listbox" className="search-results" aria-label="Tools">
        {results.map((r, i) => (
          <li key={r.slug} id={`${listId}-${i}`} role="option" aria-selected={i === active} className={i === active ? 'is-active' : undefined} onMouseMove={() => setActive(i)}>
            <Link href={`/tools/${r.slug}`} tabIndex={-1} onClick={() => onClose()}>
              <span className="sr-name">{r.name}</span>
              <span className="sr-meta">
                {r.categoryName} · {getPublicTool(r.slug)?.description}
              </span>
            </Link>
          </li>
        ))}
      </ul>
      {q.trim() && results.length === 0 && (
        <div className="search-empty" role="status">
          <p>No tools match “{q.trim()}”.</p>
          <div className="actions">
            <button type="button" className="btn btn-secondary" onClick={() => { setQ(''); inputRef.current?.focus(); }}>
              Clear search
            </button>
            <Link href="/tools" className="btn btn-ghost" onClick={() => onClose()}>
              Browse all tools
            </Link>
          </div>
        </div>
      )}
      {q.trim() && results.length > 0 && (
        <p className="search-foot">
          <Link href={`/tools?q=${encodeURIComponent(q.trim())}`} onClick={() => onClose()}>
            See all results on the tools page →
          </Link>
          <span className="hide-sm muted"> · ↑↓ to move, Enter to open</span>
        </p>
      )}
    </dialog>
  );
}
