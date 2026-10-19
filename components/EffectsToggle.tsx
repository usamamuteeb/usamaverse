'use client';

import { useEffect, useState } from 'react';

const KEY = 'usamaverse:v1:effects';

/** Lets people turn decorative motion off (stored only in this browser). */
export function EffectsToggle() {
  const [off, setOff] = useState(false);
  useEffect(() => setOff(document.documentElement.dataset.effects === 'off'), []);
  const toggle = () => {
    const next = !off;
    setOff(next);
    if (next) document.documentElement.dataset.effects = 'off';
    else delete document.documentElement.dataset.effects;
    try {
      if (next) localStorage.setItem(KEY, 'off');
      else localStorage.removeItem(KEY);
    } catch {
      /* storage blocked: applies to this visit only */
    }
  };
  return (
    <button type="button" className="link-button" aria-pressed={off} onClick={toggle}>
      Visual effects: {off ? 'off' : 'on'}
    </button>
  );
}

/** Inline, render-blocking snippet so the preference applies before first paint. */
export const effectsBootScript = `try{if(localStorage.getItem('${KEY}')==='off')document.documentElement.dataset.effects='off'}catch(e){}`;
