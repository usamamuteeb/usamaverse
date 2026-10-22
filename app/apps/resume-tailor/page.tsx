import type { Metadata } from 'next';
import Link from 'next/link';
import { ResumeTailorApp } from '@/features/apps/resume-tailor/ResumeTailorApp';

export const metadata: Metadata = {
  title: 'Resume Tailor',
  description: 'Tailor your LaTeX resume to any job description in seconds — ranked bullets, matched skills and certifications, a match score and a change log. No AI model, nothing uploaded.',
  alternates: { canonical: '/apps/resume-tailor' },
};

export default function ResumeTailorPage() {
  return (
    <div className="container page rt-page">
      <div className="rt-page-heading">
        <div>
          <h1 className="h1">
            <span aria-hidden="true">🎯</span> Resume Tailor
          </h1>
          <p className="muted">Paste a job description — get a tailored .tex, PDF, change summary and match score.</p>
        </div>
        <Link href="/apps">All apps ↗</Link>
      </div>
      <ResumeTailorApp />
    </div>
  );
}
