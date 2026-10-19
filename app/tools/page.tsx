import type { Metadata } from 'next';
import { Suspense } from 'react';
import { Breadcrumbs } from '@/components/Breadcrumbs';
import { ToolGrid } from '@/components/ToolCard';
import { ToolsBrowser } from '@/components/ToolsBrowser';
import { publicTools } from '@/lib/tools/public';

export const metadata: Metadata = {
  title: 'All tools',
  description: `Browse ${publicTools.length} free browser-based tools.`,
  alternates: { canonical: '/tools' },
};

export default function ToolsPage() {
  return (
    <div className="container page">
      <Breadcrumbs items={[{ href: '/', label: 'Home' }, { label: 'Tools' }]} />
      <h1 className="h1">All tools</h1>
      {/* Static list as fallback (no-JS, first paint); the interactive browser replaces it. */}
      <Suspense fallback={<ToolGrid tools={publicTools} />}>
        <ToolsBrowser />
      </Suspense>
    </div>
  );
}
