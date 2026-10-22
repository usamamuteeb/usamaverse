'use client';

import { useMemo, useState } from 'react';
import { SelectField, TextField } from '@/components/tool-kit/fields';
import { copyText } from '@/lib/tools/shared/clipboard';
import { SYMBOLS, SYMBOL_GROUPS } from './symbols';

export default function LatexSymbols() {
  const [q, setQ] = useState('');
  const [group, setGroup] = useState('all');
  const [copied, setCopied] = useState<string | null>(null);
  const list = useMemo(() => {
    const s = q.trim().toLowerCase();
    return SYMBOLS.filter((x) => (group === 'all' || x.group === group) && (!s || x.char === q.trim() || x.cmd.toLowerCase().includes(s) || x.name.toLowerCase().includes(s)));
  }, [q, group]);

  return (
    <div className="stack">
      <div className="sym-bar">
        <TextField label="Search by name, command or paste a symbol" value={q} onChange={setQ} placeholder="e.g. arrow, \\le, ≈, integral" type="search" />
        <SelectField label="Group" value={group} onChange={setGroup} options={[{ value: 'all', label: `All (${SYMBOLS.length})` }, ...SYMBOL_GROUPS.map((g) => ({ value: g, label: g }))]} />
      </div>
      <p className="summary" aria-live="polite">
        {copied ? `Copied ${copied}` : `${list.length} symbol${list.length === 1 ? '' : 's'} — click one to copy its command.`}
      </p>
      <ul className="sym-grid" role="list">
        {list.map((x) => (
          <li key={x.group + x.cmd}>
            <button
              type="button"
              className="sym-card"
              title={`${x.name}${x.pkg ? ` — needs \\usepackage{${x.pkg}}` : ''}${x.math ? ' (math mode)' : ''}`}
              onClick={async () => {
                const ok = await copyText(x.cmd);
                setCopied(ok ? x.cmd : `nothing — your browser blocked the clipboard (${x.cmd})`);
                setTimeout(() => setCopied(null), 2000);
              }}
            >
              <span className="sym-char" aria-hidden="true">
                {x.char}
              </span>
              <code>{x.cmd}</code>
              <span className="sym-name">
                {x.name}
                {x.pkg && <em> · {x.pkg}</em>}
              </span>
            </button>
          </li>
        ))}
      </ul>
      <p className="field-hint">Math symbols go between $…$ (or in an equation). Symbols marked with a package name need that \usepackage line in your preamble.</p>
    </div>
  );
}
