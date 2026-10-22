import type { Metadata } from 'next';
import Link from 'next/link';
import { Breadcrumbs } from '@/components/Breadcrumbs';

export const metadata: Metadata = {
  title: 'App',
  description: 'Focused, browser-local applications from UsamaVerse.',
  alternates: { canonical: '/apps' },
};

export default function AppsPage() {
  return (
    <div className="container page apps-page">
      <Breadcrumbs items={[{ href: '/', label: 'Home' }, { label: 'App' }]} />
      <p className="eyebrow">Go deeper</p>
      <h1 className="h1">App</h1>
      <p className="lead">A home for larger experiences that bring multiple features together. UsamaType for typing practice and Resume Tailor for job applications.</p>
      <div className="apps-grid">
        <Link href="/apps/typing" className="app-card">
          <span className="app-card-icon" aria-hidden="true">⌨️</span>
          <span className="app-card-text"><span className="app-card-kicker">Practice · Browser local</span><strong>UsamaType</strong><span>Build speed and accuracy with timed, word, quote and custom practice. Review honest results and history on this device.</span></span>
          <span className="app-card-arrow" aria-hidden="true">↗</span>
        </Link>
        <Link href="/apps/resume-tailor" className="app-card">
          <span className="app-card-icon" aria-hidden="true">🎯</span>
          <span className="app-card-text"><span className="app-card-kicker">Career · No AI model · Browser local</span><strong>Resume Tailor</strong><span>Keep your LaTeX resume as a default, paste a job description, and get a tailored .tex, PDF, change summary and match score — with a history of every run.</span></span>
          <span className="app-card-arrow" aria-hidden="true">↗</span>
        </Link>
      </div>
    </div>
  );
}
