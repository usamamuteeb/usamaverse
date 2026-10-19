import type { Metadata } from 'next';
import Link from 'next/link';
import { Breadcrumbs } from '@/components/Breadcrumbs';

export const metadata: Metadata = { title: 'Help', description: 'Finding and using tools.' };

export default function HelpPage() {
  return (
    <div className="container page prose-page">
      <Breadcrumbs items={[{ href: '/', label: 'Home' }, { label: 'Help' }]} />
      <h1 className="h1">Help</h1>

      <h2 className="h2">Finding a tool</h2>
      <ul>
        <li>
          Press <kbd>Ctrl</kbd> + <kbd>K</kbd> (<kbd>⌘</kbd> + <kbd>K</kbd> on Mac) anywhere outside a text box, or use the search button in the header.
        </li>
        <li>Search understands everyday words and synonyms — try “kg to lb”, “dedupe”, “epoch” or “base 64”.</li>
        <li>
          Use <kbd>↑</kbd> <kbd>↓</kbd> to move through results, <kbd>Enter</kbd> to open and <kbd>Esc</kbd> to close.
        </li>
        <li>
          On the <Link href="/tools">tools page</Link> you can filter by category; the filter is kept in the address so Back and Forward work and you can share the view.
        </li>
      </ul>

      <h2 className="h2">Using a tool</h2>
      <ul>
        <li>Most text tools update as you type. Heavier tools (images) have a button to run them.</li>
        <li>Use Copy or Download to take your result. If copying is blocked, the result is selected so you can press Ctrl/⌘ + C.</li>
        <li>Each tool page lists its limits under “Good to know”.</li>
        <li>Errors never clear your input, so you can fix it and try again.</li>
      </ul>

      <h2 className="h2">Accessibility</h2>
      <p>
        Everything works with a keyboard. If you prefer less motion, your system’s “reduce motion” setting is respected, and you can also switch visual effects off in the footer.
      </p>
    </div>
  );
}
