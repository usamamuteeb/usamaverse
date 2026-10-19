import Link from 'next/link';
import { HeroArt } from '@/components/HeroArt';
import { SearchLauncher } from '@/components/SearchLauncher';
import { ToolGrid } from '@/components/ToolCard';
import { categoriesWithCounts, editorPicks, getPublicTool, publicTools } from '@/lib/tools/public';
import type { ToolMeta } from '@/lib/tools/types';
import { siteConfig } from '@/lib/site';

export default function Home() {
  const picks = editorPicks.map((s) => getPublicTool(s)).filter((t): t is ToolMeta => Boolean(t));
  const cats = categoriesWithCounts();
  return (
    <>
      <section className="hero">
        <HeroArt />
        <div className="container hero-inner">
          <p className="eyebrow">{siteConfig.name}</p>
          <h1 className="hero-title">
            Sharp tools.
            <br />
            <span className="accent">Nothing to sign up for.</span>
          </h1>
          <p className="hero-lead">
            {publicTools.length} working tools for text, data, images, units, dates and color. They run in your browser, so what you paste or open stays on your device.
          </p>
          <div className="actions">
            <SearchLauncher />
            <Link href="/tools" className="btn btn-secondary btn-lg">
              Browse all {publicTools.length} tools
            </Link>
          </div>
          <p className="hero-hint muted">
            Tip: press <kbd>Ctrl</kbd> + <kbd>K</kbd> (or <kbd>⌘</kbd> + <kbd>K</kbd>) anywhere to search.
          </p>
        </div>
      </section>

      <section className="container section" aria-labelledby="cats-h">
        <h2 id="cats-h" className="h2">
          Categories
        </h2>
        <ul className="cat-grid" role="list">
          {cats.map((c) => (
            <li key={c.slug}>
              <Link href={`/category/${c.slug}`} className="cat-card">
                <span className="cat-card-name">{c.name}</span>
                <span className="cat-card-desc">{c.description}</span>
                <span className="cat-card-count">
                  {c.count} tool{c.count === 1 ? '' : 's'}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </section>

      <section className="container section" aria-labelledby="picks-h">
        <h2 id="picks-h" className="h2">
          Good places to start
        </h2>
        <p className="muted section-lead">A hand-picked selection, not a popularity ranking.</p>
        <ToolGrid tools={picks} />
      </section>

      <section className="container section promise" aria-labelledby="promise-h">
        <h2 id="promise-h" className="h2">
          How it works
        </h2>
        <ul className="promise-list" role="list">
          <li>
            <strong>No account.</strong> Every tool is free to use right away. Copy or download your result.
          </li>
          <li>
            <strong>Local processing.</strong> Tools labelled “runs in your browser” never send your input anywhere. The site has no analytics.
          </li>
          <li>
            <strong>Your device, your data.</strong> Favorites and recent tools are kept only in this browser, and you can clear them any time.
          </li>
        </ul>
        <p>
          <Link href="/privacy">Read the privacy details →</Link>
        </p>
      </section>
    </>
  );
}
