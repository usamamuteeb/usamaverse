import Link from 'next/link';
import { categoriesWithCounts } from '@/lib/tools/public';
import { workspacesInCategory } from '@/lib/tools/workspaces';
import { categoryEmoji } from '@/lib/ui-icons';

/** Every category → workspace → action, laid out in dense columns. */
export function Directory() {
  return (
    <div className="directory">
      {categoriesWithCounts().map((c) => (
        <section key={c.slug} className="dir-cat" aria-labelledby={`dir-${c.slug}`}>
          <h3 id={`dir-${c.slug}`} className="dir-cat-title">
            <Link href={`/category/${c.slug}`}>
              <span className="dir-cat-icon" aria-hidden="true">
                {categoryEmoji[c.slug]}
              </span>
              {c.name}
            </Link>
            <span className="count">{c.count}</span>
          </h3>
          {workspacesInCategory(c.slug).map((w) => (
            <div key={w.slug} className="dir-ws">
              <Link href={`/workspaces/${w.slug}`} className="dir-ws-title">
                {w.name}
              </Link>
              <ul role="list" className="dir-actions">
                {w.tools.map((t) => (
                  <li key={t.slug}>
                    <Link href={`/workspaces/${w.slug}?tool=${t.slug}`}>{t.name}</Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </section>
      ))}
    </div>
  );
}
