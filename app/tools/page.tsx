import type { Metadata } from 'next';
import { Suspense } from 'react';
import { ToolsBrowser } from '@/components/ToolsBrowser';
import { publicTools } from '@/lib/tools/public';
import { workspaces } from '@/lib/tools/workspaces';
import { WorkspaceGrid } from '@/components/WorkspaceCard';

export const metadata: Metadata = {
  title: 'Workspaces',
  description: `Explore ${workspaces.length} focused workspaces with ${publicTools.length} browser-based actions.`,
  alternates: { canonical: '/tools' },
};

export default function ToolsPage() {
  return (
    <div className="container page">
      <header className="page-bar">
        <h1 className="h1">Workspaces</h1>
        <p className="muted">
          {workspaces.length} workspaces · {publicTools.length} tools. Click any action to open it directly.
        </p>
      </header>
      {/* Static list as fallback (no-JS, first paint); the interactive browser replaces it. */}
      <Suspense fallback={<WorkspaceGrid items={workspaces} />}>
        <ToolsBrowser />
      </Suspense>
    </div>
  );
}
