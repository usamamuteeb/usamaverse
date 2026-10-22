'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { FavoriteButton } from './FavoriteButton';
import { ToolRunner } from './ToolRunner';
import { ToolNotes, ToolTitle } from './ToolTitle';
import { WorkspaceNav } from './WorkspaceNav';
import type { ToolWorkspace } from '@/lib/tools/workspaces';

export function WorkspaceRunner({ workspace }: { workspace: ToolWorkspace }) {
  const params = useSearchParams();
  const wanted = params.get('tool');
  const active = workspace.tools.find((item) => item.slug === wanted) ?? workspace.tools[0];
  return (
    <div className="shell">
      <aside className="shell-side">
        <WorkspaceNav category={workspace.category} workspace={workspace.slug} active={active.slug} mode="workspace" />
      </aside>
      <div className="shell-main">
        <ToolTitle
          tool={active}
          workspace={{ slug: workspace.slug, name: workspace.name }}
          actions={
            <>
              <FavoriteButton slug={active.slug} name={active.name} />
              <Link href={`/tools/${active.slug}`} className="btn btn-ghost btn-sm" title="Link to just this tool">
                Direct link ↗
              </Link>
            </>
          }
        />
        {workspace.tools.length > 1 && (
          <nav className="workspace-switcher" aria-label={`${workspace.name} actions`}>
            {workspace.tools.map((item) => (
              <Link key={item.slug} href={`/workspaces/${workspace.slug}?tool=${item.slug}`} scroll={false} aria-current={active.slug === item.slug ? 'page' : undefined}>
                {item.name}
              </Link>
            ))}
          </nav>
        )}
        <section className="workspace glass" aria-label={`${active.name} workspace`}>
          <ToolRunner key={active.slug} slug={active.slug} name={active.name} />
        </section>
        <ToolNotes tool={active} />
      </div>
    </div>
  );
}
