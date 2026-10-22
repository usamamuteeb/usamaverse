'use client';

import Link from 'next/link';
import { categoriesWithCounts } from '@/lib/tools/public';
import { workspacesInCategory } from '@/lib/tools/workspaces';
import { categoryEmoji } from '@/lib/ui-icons';

/** Every category and workspace in one compact panel (loaded only when opened). */
export default function BrowsePanel({ onNavigate }: { onNavigate: () => void }) {
  const cats = categoriesWithCounts();
  return (
    <div className="browse-panel-inner">
      <div className="browse-panel-top">
        <Link href="/tools" onClick={onNavigate} className="browse-all">
          All workspaces →
        </Link>
        <Link href="/apps/typing" onClick={onNavigate}>
          ⌨️ UsamaType app
        </Link>
        <Link href="/apps/resume-tailor" onClick={onNavigate}>
          🎯 Resume Tailor app
        </Link>
        <Link href="/favorites" onClick={onNavigate}>
          ★ Favorites
        </Link>
        <Link href="/recent" onClick={onNavigate}>
          ↺ Recent
        </Link>
      </div>
      <div className="browse-columns">
        {cats.map((c) => (
          <section key={c.slug} className="browse-group" aria-labelledby={`browse-${c.slug}`}>
            <h2 id={`browse-${c.slug}`} className="browse-group-title">
              <Link href={`/category/${c.slug}`} onClick={onNavigate}>
                <span aria-hidden="true">{categoryEmoji[c.slug]}</span> {c.name}
              </Link>
              <span className="count">{c.count}</span>
            </h2>
            <ul role="list">
              {workspacesInCategory(c.slug).map((w) => (
                <li key={w.slug}>
                  <Link href={`/workspaces/${w.slug}`} onClick={onNavigate}>
                    {w.name}
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </div>
  );
}
