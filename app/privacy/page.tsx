import type { Metadata } from 'next';
import { Breadcrumbs } from '@/components/Breadcrumbs';
import { ClearLocalDataButton } from '@/components/LocalLists';
import { siteConfig } from '@/lib/site';

export const metadata: Metadata = { title: 'Privacy', description: 'How tools process your data.' };

export default function PrivacyPage() {
  return (
    <div className="container page prose-page">
      <Breadcrumbs items={[{ href: '/', label: 'Home' }, { label: 'Privacy' }]} />
      <h1 className="h1">Privacy</h1>
      <p className="lead">A plain description of what happens to your data on {siteConfig.name}.</p>

      <h2 className="h2">Tool inputs</h2>
      <p>
        Every tool currently on this site is labelled <strong>“Runs in your browser”</strong>. Text you type or paste, and files you open, are processed by JavaScript on your device. They are not uploaded, not put in the page address, and not logged by this site’s code. The site also sets a Content Security Policy that blocks the pages from sending data to other websites.
      </p>
      <p>If a future tool ever needs a server, its page will say so clearly before you use it.</p>

      <h2 className="h2">Accounts, cookies and analytics</h2>
      <p>There are no accounts, no sign-in, no advertising and no analytics scripts. This site’s code does not set cookies.</p>

      <h2 className="h2">Stored in your browser</h2>
      <p>To be convenient, the site can remember a few things in your browser’s local storage. They never leave your device:</p>
      <ul>
        <li>Tools you mark as favorites.</li>
        <li>The last tools you opened (names only — never what you entered).</li>
        <li>Whether you turned visual effects off.</li>
        <li>The Checklist tool’s items, if you leave “keep this list” switched on.</li>
      </ul>
      <ClearLocalDataButton />

      <h2 className="h2">Hosting</h2>
      <p>Like any website, the hosting provider receives normal page requests (such as the page address and your IP address) when you load a page, and may keep standard request logs. Tool inputs are not part of those requests.</p>
    </div>
  );
}
