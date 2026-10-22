import Link from 'next/link';
import { categoriesWithCounts, categoryName } from '@/lib/tools/public';
import type { CategorySlug } from '@/lib/tools/types';
import { workspacesInCategory } from '@/lib/tools/workspaces';
import { categoryEmoji } from '@/lib/ui-icons';

/**
 * Sticky side navigation: every workspace in the category with all of its
 * actions, plus quick links to the other categories — so related tools are one
 * click away without scrolling the page.
 */
export function WorkspaceNav({ category, workspace, active, mode }: { category: CategorySlug; workspace?: string; active?: string; mode: 'workspace' | 'tool' }) {
  const groups = workspacesInCategory(category);
  const others = categoriesWithCounts().filter((c) => c.slug !== category);
  const href = (ws: string, tool: string) => (mode === 'workspace' ? `/workspaces/${ws}?tool=${tool}` : `/tools/${tool}`);
  return (
    <nav className="side-nav glass" aria-label={`${categoryName(category)} tools`}>
      <Link href={`/category/${category}`} className="side-nav-cat">
        <span aria-hidden="true">{categoryEmoji[category]}</span> {categoryName(category)}
      </Link>
      {groups.map((g) => (
        <div key={g.slug} className={g.slug === workspace ? 'side-group is-current' : 'side-group'}>
          <Link href={`/workspaces/${g.slug}`} className="side-group-title" aria-current={g.slug === workspace && !active ? 'page' : undefined}>
            {g.name}
          </Link>
          <ul role="list">
            {g.tools.map((t) => (
              <li key={t.slug}>
                <Link href={href(g.slug, t.slug)} scroll={false} aria-current={t.slug === active ? 'page' : undefined}>
                  {t.name}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      ))}
      <div className="side-other">
        <p className="side-other-title">Other categories</p>
        <ul role="list" className="side-chips">
          {others.map((c) => (
            <li key={c.slug}>
              <Link href={`/category/${c.slug}`} title={c.name}>
                <span aria-hidden="true">{categoryEmoji[c.slug]}</span> {c.name}
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </nav>
  );
}
