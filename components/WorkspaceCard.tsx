import Link from 'next/link';
import type { ToolWorkspace } from '@/lib/tools/workspaces';
import { categoryEmoji, workspaceEmoji } from '@/lib/ui-icons';

/** Compact workspace card: name, one-line purpose and every action as a direct link. */
export function WorkspaceGrid({ items }: { items: ToolWorkspace[] }) {
  return (
    <ul className="workspace-card-grid" role="list">
      {items.map((item) => (
        <li key={item.slug} className="workspace-card">
          <Link href={`/workspaces/${item.slug}`} className="workspace-card-head">
            <span className="workspace-card-icon" aria-hidden="true">
              {workspaceEmoji[item.slug] ?? categoryEmoji[item.category]}
            </span>
            <span className="workspace-card-text">
              <span className="workspace-card-title">{item.name}</span>
              <span className="workspace-card-description">{item.description}</span>
            </span>
            <span className="count">{item.tools.length}</span>
          </Link>
          <ul className="workspace-card-actions" role="list" aria-label={`${item.name} actions`}>
            {item.tools.map((t) => (
              <li key={t.slug}>
                <Link href={`/workspaces/${item.slug}?tool=${t.slug}`}>{t.name}</Link>
              </li>
            ))}
          </ul>
        </li>
      ))}
    </ul>
  );
}
