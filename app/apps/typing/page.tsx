import type { Metadata } from 'next';
import Link from 'next/link';
import { TypingApp } from '@/features/apps/typing/TypingApp';
import './typing.css';

export const metadata: Metadata = {
  title: 'UsamaType',
  description: 'Practice typing with timed, word, quote and custom text modes. Local history and personal bests stay in your browser.',
  alternates: { canonical: '/apps/typing' },
};

export default function TypingPage() {
  return (
    <div className="container page typing-page">
      <div className="typing-page-heading"><h1 className="h1"><span aria-hidden="true">⌨</span> UsamaType</h1><Link href="/apps">All apps ↗</Link></div>
      <TypingApp />
    </div>
  );
}
