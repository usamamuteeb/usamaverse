'use client';

import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useMemo, useRef, useState } from 'react';
import { categoriesWithCounts, publicSearchItems, publicTools } from '@/lib/tools/public';
import { buildIndex, search } from '@/lib/tools/search';
import { ToolGrid } from './ToolCard';
import { WorkspaceGrid } from './WorkspaceCard';
import { workspaces } from '@/lib/tools/workspaces';
import { categoryEmoji } from '@/lib/ui-icons';

const PAGE = 24;
const index = buildIndex(publicSearchItems);
const bySlug = new Map(publicTools.map((t) => [t.slug, t]));

export function ToolsBrowser() {
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const urlQ = params.get('q') ?? '';
  const category = params.get('category') ?? '';
  const [q, setQ] = useState(urlQ);
  const [limit, setLimit] = useState(PAGE);
  const drawerRef = useRef<HTMLDialogElement>(null);
  const drawerTrigger = useRef<HTMLButtonElement>(null);
  const cats = categoriesWithCounts();

  // Keep the box in sync when the user goes back/forward.
  useEffect(() => setQ(urlQ), [urlQ]);
  useEffect(() => setLimit(PAGE), [urlQ, category]);

  // Debounced URL update while typing (replace, so typing doesn't flood history).
  useEffect(() => {
    if (q === urlQ) return;
    const t = setTimeout(() => {
      const next = new URLSearchParams(params.toString());
      if (q.trim()) next.set('q', q);
      else next.delete('q');
      const qs = next.toString();
      router.replace(`${pathname}${qs ? `?${qs}` : ''}`, { scroll: false });
    }, 200);
    return () => clearTimeout(t);
  }, [q, urlQ, params, pathname, router]);

  const results = useMemo(() => {
    const list = urlQ.trim() ? search(index, urlQ).map((s) => bySlug.get(s.slug)!) : publicTools;
    return category ? list.filter((t) => t.category === category) : list;
  }, [urlQ, category]);
  const visibleWorkspaces = category ? workspaces.filter((item) => item.category === category) : workspaces;
  const browsingWorkspaces = !urlQ.trim();

  const catHref = (slug: string) => {
    const next = new URLSearchParams(params.toString());
    if (slug) next.set('category', slug);
    else next.delete('category');
    const qs = next.toString();
    return `${pathname}${qs ? `?${qs}` : ''}`;
  };

  const activeCat = cats.find((c) => c.slug === category);

  const catList = (onPick?: () => void) => (
    <ul className="cat-list" role="list">
      <li>
        <Link href={catHref('')} aria-current={!category ? 'page' : undefined} onClick={onPick} scroll={false}>
          <span><span aria-hidden="true">✨</span> All workspaces</span> <span className="count">{workspaces.length}</span>
        </Link>
      </li>
      {cats.map((c) => (
        <li key={c.slug}>
          <Link href={catHref(c.slug)} aria-current={category === c.slug ? 'page' : undefined} onClick={onPick} scroll={false}>
            <span><span aria-hidden="true">{categoryEmoji[c.slug]}</span> {c.name}</span> <span className="count">{workspaces.filter((item) => item.category === c.slug).length}</span>
          </Link>
        </li>
      ))}
    </ul>
  );

  return (
    <div className="browser">
      <aside className="browser-rail" aria-label="Categories">
        <details open className="rail-details">
          <summary>Categories</summary>
          {catList()}
        </details>
      </aside>
      <div className="browser-main">
        <div className="browser-controls">
          <label htmlFor="tools-filter" className="sr-only">
            Filter tools
          </label>
          <input id="tools-filter" type="search" className="input search-inline" placeholder="Filter by name, alias or tag…" value={q} onChange={(e) => setQ(e.target.value)} autoComplete="off" spellCheck={false} />
          <button
            ref={drawerTrigger}
            type="button"
            className="btn btn-secondary show-sm"
            aria-haspopup="dialog"
            onClick={() => drawerRef.current?.showModal()}
          >
            {activeCat ? activeCat.name : 'Categories'}
          </button>
        </div>
        <p className="summary" role="status">
          {browsingWorkspaces ? `${visibleWorkspaces.length} focused workspaces${activeCat ? ` in ${activeCat.name}` : ''}. Choose one, then switch between its actions.` : results.length === 0 ? 'No tools found.' : `${results.length} action${results.length === 1 ? '' : 's'}${activeCat ? ` in ${activeCat.name}` : ''} matching “${urlQ.trim()}”.`}
        </p>
        {browsingWorkspaces ? <WorkspaceGrid items={visibleWorkspaces} /> : results.length === 0 ? (
          <div className="empty-block">
            <p>Try a shorter or different word, or browse everything.</p>
            <div className="actions">
              {urlQ && (
                <button type="button" className="btn btn-secondary" onClick={() => setQ('')}>
                  Clear search
                </button>
              )}
              {category && (
                <Link className="btn btn-ghost" href={catHref('')} scroll={false}>
                  Search all categories
                </Link>
              )}
            </div>
          </div>
        ) : (
          <>
            <ToolGrid tools={results.slice(0, limit)} />
            {results.length > limit && (
              <div className="actions centered">
                <button type="button" className="btn btn-secondary" onClick={() => setLimit((l) => l + PAGE)}>
                  Show more ({results.length - limit} left)
                </button>
              </div>
            )}
          </>
        )}
      </div>

      <dialog
        ref={drawerRef}
        className="drawer"
        aria-label="Choose a category"
        onClose={() => drawerTrigger.current?.focus()}
        onClick={(e) => {
          if (e.target === drawerRef.current) drawerRef.current?.close();
        }}
      >
        <div className="drawer-head">
          <h2 className="h3">Categories</h2>
          <button type="button" className="btn btn-ghost" onClick={() => drawerRef.current?.close()}>
            Close
          </button>
        </div>
        {catList(() => drawerRef.current?.close())}
      </dialog>
    </div>
  );
}
