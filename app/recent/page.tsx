import type { Metadata } from 'next';
import { Breadcrumbs } from '@/components/Breadcrumbs';
import { RecentList } from '@/components/LocalLists';

export const metadata: Metadata = { title: 'Recent tools', robots: { index: false } };

export default function RecentPage() {
  return (
    <div className="container page">
      <Breadcrumbs items={[{ href: '/', label: 'Home' }, { label: 'Recent' }]} />
      <h1 className="h1">Recent tools</h1>
      <p className="lead">The last tools you opened, kept only in this browser. Your inputs are never saved.</p>
      <RecentList />
    </div>
  );
}
