'use client';

import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { ToolLoadingPortal } from './ToolLoadingPortal';

/** Show the same loader while a tool route's code is still being fetched. */
export function NavigationLoading() {
  const pathname = usePathname();
  const [pendingFrom, setPendingFrom] = useState<string | null>(null);

  useEffect(() => {
    const onClick = (event: MouseEvent) => {
      if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      const target = event.target;
      const link = target instanceof Element ? target.closest<HTMLAnchorElement>('a[href]') : null;
      if (!link || link.hasAttribute('download') || (link.target && link.target !== '_self')) return;
      const destination = new URL(link.href, window.location.href);
      if (destination.origin !== window.location.origin || destination.pathname === window.location.pathname) return;
      if (!destination.pathname.startsWith('/tools/') && !destination.pathname.startsWith('/workspaces/')) return;
      setPendingFrom(window.location.pathname);
    };
    document.addEventListener('click', onClick, true);
    return () => document.removeEventListener('click', onClick, true);
  }, []);

  useEffect(() => {
    if (pendingFrom === null) return;
    const timeout = window.setTimeout(() => setPendingFrom(null), 15_000);
    return () => window.clearTimeout(timeout);
  }, [pendingFrom]);

  return pendingFrom === pathname ? <ToolLoadingPortal /> : null;
}
