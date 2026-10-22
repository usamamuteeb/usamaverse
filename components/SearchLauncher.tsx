'use client';

import { OPEN_SEARCH_EVENT } from './SiteHeader';

/** Opens the global search. `bar` looks like a search field (used on the home page). */
export function SearchLauncher({ label = 'Search tools', variant = 'bar' }: { label?: string; variant?: 'bar' | 'button' }) {
  const open = () => window.dispatchEvent(new Event(OPEN_SEARCH_EVENT));
  if (variant === 'button')
    return (
      <button type="button" className="btn btn-primary" onClick={open}>
        {label}
      </button>
    );
  return (
    <button type="button" className="search-bar" onClick={open} aria-haspopup="dialog">
      <svg viewBox="0 0 20 20" width="18" height="18" aria-hidden="true">
        <circle cx="8.5" cy="8.5" r="5.5" fill="none" stroke="currentColor" strokeWidth="2" />
        <path d="m13 13 4 4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      </svg>
      <span>{label}</span>
    </button>
  );
}
