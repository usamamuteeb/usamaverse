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

      <h2 className="h2">Using an app</h2>
      <p>The <Link href="/apps">App tab</Link> opens larger experiences. UsamaType includes practice modes, results and history kept only in this browser. Its “How it works” panel explains the scoring rule.</p>
      <p>
        <Link href="/apps/resume-tailor">Resume Tailor</Link> keeps your LaTeX resume, bullet bank, skills and certifications as defaults in Setup; each run needs only a job description. It works by clear rules — no AI model — and lists every change it made. Compile the tailored .tex (for example on Overleaf) for your template’s exact look, or download a PDF directly.
      </p>

      <h2 className="h2">CV and LaTeX tools</h2>
      <ul>
        <li>The CV Builder, CV to LaTeX and LaTeX CV Converter share one CV format, so you can move a CV between them with “Send to CV Builder”.</li>
        <li>Imports from PDF and Word are best effort — headings such as Experience, Education and Skills, bullet points and date ranges help the most.</li>
        <li>Direct PDF downloads use the standard PDF fonts (Western European letters). For other scripts use “Print / Save as PDF”.</li>
      </ul>

      <h2 className="h2">Accessibility</h2>
      <p>
        Everything works with a keyboard. If you prefer less motion, your system’s “reduce motion” setting is respected, and you can also switch visual effects off in the footer.
      </p>
    </div>
  );
}
