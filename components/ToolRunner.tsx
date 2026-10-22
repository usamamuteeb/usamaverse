'use client';

import { Component, createElement, lazy, Suspense, useEffect, useState, type ComponentType, type LazyExoticComponent, type ReactNode } from 'react';
import { loaders } from '@/lib/tools/loader-map';
import { recordRecent } from '@/lib/local-store';
import { ToolLoadingPortal } from './ToolLoadingPortal';

const toolComponents = new Map<string, LazyExoticComponent<ComponentType>>(Object.entries(loaders).map(([slug, load]) => [slug, lazy(load)]));

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

/** Loads only this tool's code, in the browser, after the page shell is visible. */
export function ToolRunner({ slug, name }: { slug: string; name?: string }) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    recordRecent(slug);
  }, [slug]);

  if (!mounted) return <ToolLoadingPortal name={name} />;
  const Tool = toolComponents.get(slug);
  if (!Tool) return <p className="status status-error">Unknown tool.</p>;
  return (
    <ToolErrorBoundary
      onRetry={() => window.location.reload()}
    >
      <Suspense fallback={<ToolLoadingPortal name={name} />}>
        {createElement(Tool)}
      </Suspense>
    </ToolErrorBoundary>
  );
}
