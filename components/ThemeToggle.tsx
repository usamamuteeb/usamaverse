'use client';

import { useEffect, useState } from 'react';

const KEY = 'usamaverse:v1:theme';
type Theme = 'light' | 'dark';

function current(): Theme {
  const set = document.documentElement.dataset.theme;
  if (set === 'light' || set === 'dark') return set;
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

/** Switches between the light and dark glass themes. The choice is stored only in this browser. */
export function ThemeToggle() {
  const [theme, setTheme] = useState<Theme | null>(null);
  useEffect(() => setTheme(current()), []);
  const next: Theme = theme === 'dark' ? 'light' : 'dark';
  return (
    <button
      type="button"
      className="icon-toggle"
      aria-label={theme ? `Switch to ${next} theme` : 'Switch theme'}
      title={theme ? `Switch to ${next} theme` : 'Switch theme'}
      onClick={() => {
        const t = current() === 'dark' ? 'light' : 'dark';
        document.documentElement.dataset.theme = t;
        setTheme(t);
        try {
          localStorage.setItem(KEY, t);
        } catch {
          /* storage blocked: applies to this visit only */
        }
      }}
    >
      <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" className="icon-sun">
        <circle cx="12" cy="12" r="4.2" fill="none" stroke="currentColor" strokeWidth="2" />
        <path d="M12 2.5v2.2M12 19.3v2.2M2.5 12h2.2M19.3 12h2.2M5.3 5.3l1.6 1.6M17.1 17.1l1.6 1.6M5.3 18.7l1.6-1.6M17.1 6.9l1.6-1.6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      </svg>
      <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" className="icon-moon">
        <path d="M20 14.5A8.5 8.5 0 0 1 9.5 4a8.5 8.5 0 1 0 10.5 10.5Z" fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
      </svg>
    </button>
  );
}

/** Runs before first paint so a stored theme never flashes the wrong colors. */
export const themeBootScript = `try{var t=localStorage.getItem('${KEY}');if(t==='light'||t==='dark')document.documentElement.dataset.theme=t}catch(e){}`;
