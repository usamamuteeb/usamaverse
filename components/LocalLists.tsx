'use client';

import Link from 'next/link';
import { useFavorites, useRecent, clearAllLocalData } from '@/lib/local-store';
import { getPublicTool } from '@/lib/tools/public';
import type { ToolMeta } from '@/lib/tools/types';
import { ToolGrid } from './ToolCard';
import { useState } from 'react';
import { clearHistory, clearTypingSettings } from '@/features/apps/typing/storage';

function resolve(slugs: string[]): ToolMeta[] {
  return slugs.map((s) => getPublicTool(s)).filter((t): t is ToolMeta => Boolean(t));
}

export function FavoritesList() {
  const { favorites, clear } = useFavorites();
  const tools = resolve(favorites);
  return (
    <>
      {tools.length === 0 ? (
        <p className="empty-state">
          No favorites yet. Use the ☆ Save button on any tool. <Link href="/tools">Browse tools</Link>
        </p>
      ) : (
        <>
          <ToolGrid tools={tools} />
          <div className="actions">
            <button type="button" className="btn btn-ghost" onClick={clear}>
              Clear favorites
            </button>
          </div>
        </>
      )}
    </>
  );
}

export function RecentList() {
  const { recent, clear } = useRecent();
  const tools = resolve(recent);
  return tools.length === 0 ? (
    <p className="empty-state">
      Tools you open will appear here. <Link href="/tools">Browse tools</Link>
    </p>
  ) : (
    <>
      <ToolGrid tools={tools} />
      <div className="actions">
        <button type="button" className="btn btn-ghost" onClick={clear}>
          Clear recent tools
        </button>
      </div>
    </>
  );
}

export function ClearLocalDataButton() {
  const [message, setMessage] = useState('');
  return (
    <>
      <button
        type="button"
        className="btn btn-secondary"
        onClick={async () => {
          if (!window.confirm('Clear all site data in this browser — favorites, CV and Resume Tailor drafts and history, typing history and settings? This cannot be undone.')) return;
          clearAllLocalData();
          clearTypingSettings();
          delete document.documentElement.dataset.effects;
          try {
            await clearHistory();
            setMessage('Cleared favorites, recent tools, saved drafts (CV, Resume Tailor, invoice), settings and local typing history.');
          } catch {
            setMessage('Cleared site preferences, but local typing history could not be cleared here. Open Typing Studio → Local history to try again.');
          }
        }}
      >
        Clear all data this site saved in this browser
      </button>
      <span role="status" className="inline-note">
        {message}
      </span>
    </>
  );
}
