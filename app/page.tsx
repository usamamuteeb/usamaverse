import Link from 'next/link';
import { HeroArt } from '@/components/HeroArt';
import { SearchLauncher } from '@/components/SearchLauncher';
import { publicTools } from '@/lib/tools/public';
import { workspaces } from '@/lib/tools/workspaces';

const SHORTCUTS = [
  ['pdf-editor', '📝 Edit a PDF'],
  ['pdf-pages', '📚 Merge PDFs'],
  ['image-editor', '🖼️ Resize an image'],
  ['text-editor', '✍️ Clean up text'],
  ['data-formats', '🧩 Format code'],
] as const;

const ROUTES = [
  { href: '/category/pdf', icon: '📄', title: 'Work with PDFs', detail: 'Edit, convert, organize and sign.' },
  { href: '/category/image', icon: '🎨', title: 'Create & refine', detail: 'Images, colors and content.' },
  { href: '/apps', icon: '⌨️', title: 'Go further with apps', detail: 'Build a CV or practice typing.' },
] as const;

export default function Home() {
  return (
    <main className="container page home">
      <section className="home-hero glass" aria-labelledby="home-h">
        <div className="home-hero-text">
          <p className="home-kicker"><span aria-hidden="true" /> A simpler way to get things done</p>
          <h1 id="home-h" className="home-title">
            Make the small tasks <span className="accent">feel effortless.</span>
          </h1>
          <p className="home-lead">
            From a quick PDF edit to a polished CV, find what you need and get moving. {publicTools.length} useful actions, {workspaces.length} focused workspaces, all in your browser.
          </p>
          <div className="home-entry">
            <SearchLauncher label="What would you like to do?" />
            <Link href="/tools" className="home-browse-link">Browse workspaces <span aria-hidden="true">↗</span></Link>
          </div>
          <nav className="home-shortcuts" aria-label="Popular shortcuts">
            <span className="home-shortcuts-label">Jump right in</span>
            {SHORTCUTS.map(([slug, label]) => (
              <Link href={`/workspaces/${slug}`} key={slug}>{label}</Link>
            ))}
          </nav>
        </div>
        <div className="home-hero-visual" aria-hidden="true">
          <HeroArt />
          <div className="home-visual-caption"><span>✦</span> Your ideas, in motion</div>
        </div>
      </section>

      <section className="home-routes" aria-labelledby="home-routes-h">
        <div className="home-routes-heading">
          <div>
            <p className="home-section-kicker">Where to begin</p>
            <h2 id="home-routes-h">Choose a direction.</h2>
          </div>
          <Link href="/tools">Explore every workspace <span aria-hidden="true">→</span></Link>
        </div>
        <div className="home-routes-grid">
          {ROUTES.map((route) => (
            <Link href={route.href} className="home-route" key={route.href}>
              <span className="home-route-icon" aria-hidden="true">{route.icon}</span>
              <span className="home-route-copy"><strong>{route.title}</strong><small>{route.detail}</small></span>
              <span className="home-route-arrow" aria-hidden="true">↗</span>
            </Link>
          ))}
        </div>
      </section>

      <ul className="trust-strip glass" role="list">
        <li><span aria-hidden="true">⚡</span> <strong>Start instantly.</strong> No sign-up.</li>
        <li><span aria-hidden="true">🔒</span> <strong>Keep it private.</strong> Your files stay on your device.</li>
        <li><span aria-hidden="true">💾</span> <strong>Pick up anytime.</strong> Favorites stay in this browser. <Link href="/privacy">Privacy details</Link></li>
      </ul>
    </main>
  );
}
