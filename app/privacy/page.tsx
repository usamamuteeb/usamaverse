import type { Metadata } from 'next';
import Link from 'next/link';
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
        <li>UsamaType’s compact practice settings. Custom passages are not saved.</li>
        <li>Your CV Builder draft, if “Remember my draft in this browser” is on (it is on by default and can be switched off in the builder).</li>
        <li>Resume Tailor’s setup (your base resume, banks and rules) and its run history (job descriptions, tailored .tex files and scores, up to 40 runs).</li>
        <li>Your business details in the Invoice Generator, only if you tick “Remember my business details”.</li>
      </ul>
      <p>CV, resume and invoice data can contain personal details. On a shared computer, clear it with the button below or from each tool.</p>
      <p><Link href="/apps/typing">UsamaType</Link> also keeps result summaries in this browser’s IndexedDB, if available. It does not save the text you typed or individual key timings. You can view, export or clear that history from the app.</p>
      <ClearLocalDataButton />

      <h2 className="h2">Hosting</h2>
      <p>Like any website, the hosting provider receives normal page requests (such as the page address and your IP address) when you load a page, and may keep standard request logs. Tool inputs are not part of those requests.</p>
    </div>
  );
}
