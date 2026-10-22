'use client';

import { useMemo, useState } from 'react';
import rawData, { type EmojiMartData } from '@emoji-mart/data';
import { Button } from '@/components/tool-kit/actions';
import { SelectField, TextField } from '@/components/tool-kit/fields';

const data = rawData as unknown as EmojiMartData;
const categoryOptions = [{ value: 'all', label: 'All emoji' }, ...data.categories.map((c) => ({ value: c.id, label: c.id[0].toUpperCase() + c.id.slice(1) }))];
const byCategory = new Map(data.categories.flatMap((c) => c.emojis.map((id) => [id, c.id] as const)));
const emojis = Object.values(data.emojis).map((e) => ({ ...e, category: byCategory.get(e.id) ?? '', search: `${e.name} ${e.id} ${e.keywords.join(' ')}`.toLowerCase() }));

export default function EmojiSearch() {
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('all');
  const [limit, setLimit] = useState(120);
  const [chosen, setChosen] = useState('');
  const [note, setNote] = useState('');
  const matches = useMemo(() => {
    const terms = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
    return emojis.filter((e) => (category === 'all' || e.category === category) && terms.every((term) => e.search.includes(term)));
  }, [query, category]);
  return <div className="stack">
    <div className="field-row"><TextField label="Search by name or keyword" value={query} onChange={(v) => { setQuery(v); setLimit(120); }} placeholder="smile, cat, flag…" type="search" /><SelectField label="Category" value={category} onChange={(v) => { setCategory(v); setLimit(120); }} options={categoryOptions} /></div>
    <p className="summary">{matches.length.toLocaleString()} results. Select an emoji to copy it. {note}</p>
    {chosen && <p className="summary" aria-live="polite">Selected: <strong>{chosen}</strong></p>}
    <div className="emoji-grid">{matches.slice(0, limit).map((e) => <button className="emoji-item" type="button" key={e.id} title={e.name} aria-label={e.name} onClick={async () => {
      const value = e.skins[0].native;
      setChosen(`${value} ${e.name}`);
      try { await navigator.clipboard.writeText(value); setNote(`${e.name} copied.`); } catch { setNote('Select the character above to copy it.'); }
    }}>{e.skins[0].native}</button>)}</div>
    {limit < matches.length && <Button onClick={() => setLimit((n) => n + 120)}>Show more</Button>}
    <p className="field-hint">Uses the locally bundled Emoji Mart Unicode 15 data. Appearance depends on your operating system and font.</p>
  </div>;
}
