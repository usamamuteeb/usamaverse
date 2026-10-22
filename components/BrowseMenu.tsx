'use client';

import { lazy, Suspense, useEffect, useRef, useState } from 'react';
import { usePathname } from 'next/navigation';

const BrowsePanel = lazy(() => import('./BrowsePanel'));

/** Header button that opens a panel listing every category and workspace. */
export function BrowseMenu() {
  const [open, setOpen] = useState(false);
  const wrap = useRef<HTMLDivElement>(null);
  const button = useRef<HTMLButtonElement>(null);
  const pathname = usePathname();

  useEffect(() => setOpen(false), [pathname]);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setOpen(false);
        button.current?.focus();
      }
    };
    const onClick = (e: MouseEvent) => {
      if (wrap.current && !wrap.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('keydown', onKey);
    document.addEventListener('mousedown', onClick);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('mousedown', onClick);
    };
  }, [open]);

  return (
    <div className="browse-menu" ref={wrap}>
      <button ref={button} type="button" className="browse-trigger" aria-expanded={open} aria-controls="browse-panel" onClick={() => setOpen((o) => !o)}>
        Browse
        <svg viewBox="0 0 12 12" width="10" height="10" aria-hidden="true">
          <path d="M2 4l4 4 4-4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
      {open && (
        <div id="browse-panel" className="browse-panel glass" role="region" aria-label="Browse all tools">
          <Suspense fallback={<p className="summary">Loading…</p>}>
            <BrowsePanel onNavigate={() => setOpen(false)} />
          </Suspense>
        </div>
      )}
    </div>
  );
}
