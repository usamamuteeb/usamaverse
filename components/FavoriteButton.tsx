'use client';

import { useFavorites } from '@/lib/local-store';

export function FavoriteButton({ slug, name }: { slug: string; name: string }) {
  const { isFavorite, toggle } = useFavorites();
  const on = isFavorite(slug);
  return (
    <button type="button" className="btn btn-ghost fav-btn" aria-pressed={on} onClick={() => toggle(slug)} title="Saved only in this browser">
      <span aria-hidden="true">{on ? '★' : '☆'}</span> {on ? 'Saved' : 'Save'}
      <span className="sr-only"> {name} to favorites in this browser</span>
    </button>
  );
}
