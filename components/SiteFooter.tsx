import Link from 'next/link';
import { siteConfig } from '@/lib/site';
import { EffectsToggle } from './EffectsToggle';

export function SiteFooter() {
  return (
    <footer className="site-footer">
      <div className="container footer-inner">
        <p className="muted">
          {siteConfig.name} — free tools, no account. Tools marked “runs in your browser” never upload what you enter.
        </p>
        <nav aria-label="Footer" className="footer-nav">
          <Link href="/tools">All tools</Link>
          <Link href="/recent">Recent</Link>
          <Link href="/privacy">Privacy</Link>
          <Link href="/help">Help</Link>
          <Link href="/feedback">Feedback</Link>
          <EffectsToggle />
        </nav>
      </div>
    </footer>
  );
}
