'use client';

import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { ToolLoading } from './ToolLoading';

/** A portal keeps the overlay viewport-centered outside the workspace's glass filter. */
export function ToolLoadingPortal({ name }: { name?: string }) {
  const [ready, setReady] = useState(false);
  useEffect(() => {
    const frame = requestAnimationFrame(() => setReady(true));
    return () => cancelAnimationFrame(frame);
  }, []);
  return ready ? createPortal(<ToolLoading name={name} />, document.body) : null;
}
