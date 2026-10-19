import type { Metadata } from 'next';
import { Breadcrumbs } from '@/components/Breadcrumbs';
import { FeedbackComposer } from '@/components/FeedbackComposer';
import { siteConfig } from '@/lib/site';

export const metadata: Metadata = { title: 'Feedback', description: 'Report a problem or suggest a tool.' };

export default function FeedbackPage() {
  return (
    <div className="container page prose-page">
      <Breadcrumbs items={[{ href: '/', label: 'Home' }, { label: 'Feedback' }]} />
      <h1 className="h1">Feedback</h1>
      <p className="lead">Found a bug or want a tool? Write it below. Nothing is sent automatically.</p>
      <FeedbackComposer email={siteConfig.feedbackEmail} />
    </div>
  );
}
