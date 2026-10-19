import type { Metadata } from 'next';
import { Breadcrumbs } from '@/components/Breadcrumbs';
import { FavoritesList } from '@/components/LocalLists';

export const metadata: Metadata = { title: 'Favorites', robots: { index: false } };

export default function FavoritesPage() {
  return (
    <div className="container page">
      <Breadcrumbs items={[{ href: '/', label: 'Home' }, { label: 'Favorites' }]} />
      <h1 className="h1">Favorites</h1>
      <p className="lead">Saved only in this browser on this device. Nothing is synced or sent anywhere.</p>
      <FavoritesList />
    </div>
  );
}
