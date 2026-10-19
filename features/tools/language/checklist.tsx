'use client';

import { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/tool-kit/actions';
import { TextField } from '@/components/tool-kit/fields';

const KEY = 'usamaverse:v1:checklist';
interface Item { id: number; text: string; done: boolean }

function load(): { title: string; items: Item[] } | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const v = JSON.parse(raw);
    if (v && Array.isArray(v.items)) return { title: String(v.title ?? ''), items: v.items.filter((i: Item) => typeof i.text === 'string').slice(0, 500) };
  } catch {
    /* ignore */
  }
  return null;
}

export default function Checklist() {
  const [title, setTitle] = useState('My checklist');
  const [items, setItems] = useState<Item[]>([]);
  const [draft, setDraft] = useState('');
  const [save, setSave] = useState(true);
  const loaded = useRef(false);
  useEffect(() => {
    const v = load();
    if (v) {
      setTitle(v.title);
      setItems(v.items);
    }
    loaded.current = true;
  }, []);
  useEffect(() => {
    if (!loaded.current) return;
    try {
      if (save && (items.length || title !== 'My checklist')) localStorage.setItem(KEY, JSON.stringify({ title, items }));
      else localStorage.removeItem(KEY);
    } catch {
      /* storage blocked */
    }
  }, [title, items, save]);
  const add = () => {
    const t = draft.trim();
    if (!t) return;
    setItems((x) => [...x, { id: Date.now() + Math.random(), text: t.slice(0, 300), done: false }]);
    setDraft('');
  };
  const done = items.filter((i) => i.done).length;
  return (
    <div className="stack">
      <div className="no-print stack">
        <TextField label="Title" value={title} onChange={setTitle} />
        <form className="color-pair" onSubmit={(e) => { e.preventDefault(); add(); }}>
          <TextField label="New item" value={draft} onChange={setDraft} />
          <Button type="submit" variant="primary">Add</Button>
        </form>
      </div>
      <section className="printable" aria-labelledby="cl-title">
        <h2 id="cl-title" className="h2">{title}</h2>
        {items.length === 0 ? (
          <p className="empty-state no-print">No items yet.</p>
        ) : (
          <ul className="checklist">
            {items.map((it, i) => (
              <li key={it.id} className={it.done ? 'done' : undefined}>
                <input id={`ci-${it.id}`} type="checkbox" className="checkbox" checked={it.done} onChange={(e) => setItems((x) => x.map((y) => (y.id === it.id ? { ...y, done: e.target.checked } : y)))} />
                <label htmlFor={`ci-${it.id}`} className="check-label">{it.text}</label>
                <span className="actions tight no-print">
                  <Button variant="ghost" ariaLabel={`Move ${it.text} up`} disabled={i === 0} onClick={() => setItems((x) => { const a = x.slice(); [a[i - 1], a[i]] = [a[i], a[i - 1]]; return a; })}>↑</Button>
                  <Button variant="ghost" ariaLabel={`Delete ${it.text}`} onClick={() => setItems((x) => x.filter((y) => y.id !== it.id))}>✕</Button>
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
      <p className="summary no-print" aria-live="polite">{items.length ? `${done} of ${items.length} done.` : ''}</p>
      <div className="actions no-print">
        <Button onClick={() => window.print()} disabled={!items.length}>Print</Button>
        <Button variant="ghost" onClick={() => setItems((x) => x.map((i) => ({ ...i, done: false })))} disabled={!done}>Uncheck all</Button>
        <Button variant="ghost" onClick={() => setItems((x) => x.filter((i) => !i.done))} disabled={!done}>Remove checked</Button>
        <Button variant="ghost" onClick={() => { setItems([]); setTitle('My checklist'); }}>Clear list</Button>
      </div>
      <label className="field-check no-print">
        <input type="checkbox" className="checkbox" checked={save} onChange={(e) => setSave(e.target.checked)} />
        <span>Keep this list in this browser (local storage only, never uploaded)</span>
      </label>
    </div>
  );
}
