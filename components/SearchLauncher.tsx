'use client';

import { OPEN_SEARCH_EVENT } from './SiteHeader';

export function SearchLauncher({ label = 'Search tools' }: { label?: string }) {
  return (
    <button type="button" className="btn btn-primary btn-lg" onClick={() => window.dispatchEvent(new Event(OPEN_SEARCH_EVENT))}>
      {label}
    </button>
  );
}
