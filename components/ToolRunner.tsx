'use client';

import { Component, lazy, Suspense, useEffect, useState, type ComponentType, type LazyExoticComponent, type ReactNode } from 'react';
import { loaders } from '@/lib/tools/loader-map';
import { recordRecent } from '@/lib/local-store';

const cache = new Map<string, LazyExoticComponent<ComponentType>>();

function getLazy(slug: string) {
  let c = cache.get(slug);
  if (!c) {
    const load = loaders[slug];
    if (!load) return null;
    c = lazy(load);
    cache.set(slug, c);
  }
  return c;
}

class ToolErrorBoundary extends Component<{ children: ReactNode; onRetry: () => void }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    if (this.state.failed) {
      return (
        <div className="status status-error" role="alert">
          <span className="status-icon" aria-hidden="true">
            ✕
          </span>
          <span>
            <strong>Error:</strong> This tool could not load (you may be offline, or the site was updated).{' '}
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => {
                this.setState({ failed: false });
                this.props.onRetry();
              }}
            >
              Try again
            </button>
          </span>
        </div>
      );
    }
    return this.props.children;
  }
}

function Loading() {
  return (
    <div className="tool-loading" role="status">
      <span className="spinner" aria-hidden="true" /> Loading tool…
    </div>
  );
}

/** Loads only this tool's code, in the browser, after the page shell is visible. */
export function ToolRunner({ slug }: { slug: string }) {
  const [mounted, setMounted] = useState(false);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    setMounted(true);
    recordRecent(slug);
  }, [slug]);

  if (!mounted) return <Loading />;
  const Tool = getLazy(slug);
  if (!Tool) return <p className="status status-error">Unknown tool.</p>;
  return (
    <ToolErrorBoundary
      key={attempt}
      onRetry={() => {
        cache.delete(slug);
        setAttempt((a) => a + 1);
      }}
    >
      <Suspense fallback={<Loading />}>
        <Tool />
      </Suspense>
    </ToolErrorBoundary>
  );
}
