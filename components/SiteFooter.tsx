import Link from 'next/link';
import { siteConfig } from '@/lib/site';
import { EffectsToggle } from './EffectsToggle';

export function SiteFooter() {
  return (
    <footer className="site-footer">
      <div className="container footer-inner">
        <p className="muted">
          <strong>{siteConfig.name}</strong> · free tools, no account, processed on your device.
        </p>
        <nav aria-label="Footer" className="footer-nav">
          <Link href="/tools">Workspaces</Link>
          <Link href="/apps">App</Link>
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
