'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { lazy, Suspense, useCallback, useEffect, useRef, useState } from 'react';
import { Wordmark } from './Brand';
import { BrowseMenu } from './BrowseMenu';
import { ThemeToggle } from './ThemeToggle';

const SearchDialog = lazy(() => import('./SearchDialog'));

function isEditable(el: EventTarget | null): boolean {
  if (!(el instanceof HTMLElement)) return false;
  const tag = el.tagName;
  return el.isContentEditable || tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT';
}

/** Global event so other components (e.g. the landing hero) can open search. */
export const OPEN_SEARCH_EVENT = 'usamaverse:open-search';

export function SiteHeader() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [requested, setRequested] = useState(false);
  const [isMac, setIsMac] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const returnFocus = useRef<HTMLElement | null>(null);

  const openSearch = useCallback(() => {
    returnFocus.current = (document.activeElement as HTMLElement) ?? triggerRef.current;
    setRequested(true);
    setOpen(true);
  }, []);

  useEffect(() => {
    setIsMac(/Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent));
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && !e.altKey && e.key.toLowerCase() === 'k' && !isEditable(e.target)) {
        e.preventDefault();
        openSearch();
      }
    };
    const onOpen = () => openSearch();
    window.addEventListener('keydown', onKey);
    window.addEventListener(OPEN_SEARCH_EVENT, onOpen);
    return () => {
      window.removeEventListener('keydown', onKey);
      window.removeEventListener(OPEN_SEARCH_EVENT, onOpen);
    };
  }, [openSearch]);

  const close = useCallback(() => {
    setOpen(false);
    const el = returnFocus.current ?? triggerRef.current;
    requestAnimationFrame(() => el?.focus());
  }, []);

  return (
    <header className="site-header">
      <a href="#main" className="skip-link">
        Skip to content
      </a>
      <div className="container header-inner">
        <Link href="/" className="brand-link" aria-label="Home">
          <Wordmark />
        </Link>
        <nav aria-label="Main" className="main-nav">
          <BrowseMenu />
          <Link href="/tools" className="hide-sm" aria-current={pathname === '/tools' ? 'page' : undefined}>Workspaces</Link>
          <Link href="/apps" aria-current={pathname === '/apps' || pathname.startsWith('/apps/') ? 'page' : undefined}>App</Link>
          <Link href="/favorites" className="hide-md" aria-current={pathname === '/favorites' ? 'page' : undefined}>
            Favorites
          </Link>
        </nav>
        <button ref={triggerRef} type="button" className="search-trigger" onClick={openSearch} aria-haspopup="dialog" aria-label="Search tools" aria-keyshortcuts="Control+K Meta+K">
          <svg viewBox="0 0 20 20" width="16" height="16" aria-hidden="true">
            <circle cx="8.5" cy="8.5" r="5.5" fill="none" stroke="currentColor" strokeWidth="2" />
            <path d="m13 13 4 4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          </svg>
          <span className="search-trigger-text">Search tools</span>
          <kbd className="hide-sm">{isMac ? '⌘' : 'Ctrl'} K</kbd>
        </button>
        <ThemeToggle />
      </div>
      {requested && (
        <Suspense fallback={null}>
          <SearchDialog open={open} onClose={close} />
        </Suspense>
      )}
    </header>
  );
}
