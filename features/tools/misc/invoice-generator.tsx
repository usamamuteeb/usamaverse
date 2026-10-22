'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { Button, DownloadTextButton } from '@/components/tool-kit/actions';
import { CheckboxField, SelectField, Status, TextAreaField, TextField } from '@/components/tool-kit/fields';
import { downloadBlob } from '@/lib/tools/shared/download';
import { printHtml } from '@/lib/tools/shared/print';
import { CURRENCIES, computeTotals, emptyItem, money, num, sampleInvoice, type Invoice, type InvoiceItem, type Party } from './invoice';

const FROM_KEY = 'usamaverse:v1:invoice-from';
const ACCENTS = [
  { value: '#b3263e', label: 'Crimson' },
  { value: '#1f4e9a', label: 'Blue' },
  { value: '#2e7d32', label: 'Green' },
  { value: '#5e35b1', label: 'Purple' },
  { value: '#222222', label: 'Black' },
];
const emptyParty = (): Party => ({ name: '', address: '', email: '', phone: '', taxId: '' });
const blank = (): Invoice => ({
  from: emptyParty(),
  to: emptyParty(),
  number: 'INV-0001',
  issued: '',
  due: '',
  currency: 'USD',
  discount: '',
  shipping: '',
  items: [emptyItem()],
  notes: '',
  terms: '',
});

function PartyFields({ title, p, onChange }: { title: string; p: Party; onChange: (p: Party) => void }) {
  const set = (k: keyof Party) => (v: string) => onChange({ ...p, [k]: v });
  return (
    <fieldset className="options">
      <legend>{title}</legend>
      <TextField label="Name / company" value={p.name} onChange={set('name')} />
      <TextField label="Email" value={p.email} onChange={set('email')} />
      <TextField label="Phone" value={p.phone} onChange={set('phone')} />
      <TextField label="Tax / VAT number" value={p.taxId} onChange={set('taxId')} />
      <TextAreaField label="Address" mono={false} rows={2} value={p.address} onChange={set('address')} />
    </fieldset>
  );
}

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);

export default function InvoiceGenerator() {
  const [inv, setInv] = useState<Invoice>(blank);
  const [accent, setAccent] = useState('#b3263e');
  const [paper, setPaper] = useState<'a4' | 'letter'>('a4');
  const [remember, setRemember] = useState(false);
  const [msg, setMsg] = useState<{ tone: 'error' | 'warn' | 'success' | 'info'; text: string } | null>(null);
  const sheet = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const today = new Date();
    setInv((x) => ({ ...x, issued: x.issued || today.toISOString().slice(0, 10), due: x.due || new Date(today.getTime() + 14 * 864e5).toISOString().slice(0, 10) }));
    try {
      const raw = localStorage.getItem(FROM_KEY);
      if (raw) {
        const from = JSON.parse(raw) as Party;
        setInv((x) => ({ ...x, from: { ...emptyParty(), ...from } }));
        setRemember(true);
      }
    } catch {
      /* storage blocked */
    }
  }, []);
  useEffect(() => {
    try {
      if (remember) localStorage.setItem(FROM_KEY, JSON.stringify(inv.from));
    } catch {
      /* storage blocked */
    }
  }, [remember, inv.from]);

  const t = useMemo(() => computeTotals(inv), [inv]);
  const fmt = (minor: number) => money(minor, inv.currency, t.digits);
  const setItem = (i: number, it: InvoiceItem) => setInv((x) => ({ ...x, items: x.items.map((y, j) => (j === i ? it : y)) }));
  const stem = `invoice-${(inv.number || 'draft').replace(/[^\w-]+/g, '-')}`;

  const pdf = async () => {
    try {
      const { invoiceToPdf } = await import('./invoice-pdf');
      const r = await invoiceToPdf(inv, accent, paper);
      downloadBlob(new Blob([r.bytes as BlobPart], { type: 'application/pdf' }), `${stem}.pdf`);
      setMsg(r.missing.length ? { tone: 'warn', text: `Some characters (${r.missing.slice(0, 8).join(' ')}) are not in the PDF’s standard fonts and show as “?”. Use Print / Save as PDF for them.` } : { tone: 'success', text: `${stem}.pdf saved.` });
    } catch (e) {
      setMsg({ tone: 'error', text: e instanceof Error ? e.message : String(e) });
    }
  };

  const csv = ['Description,Quantity,Unit price,Tax %,Amount', ...inv.items.filter((i) => i.description || i.price).map((it, k) => [it.description, it.qty, it.price, it.tax, (t.lines[k].amount / 10 ** t.digits).toFixed(t.digits)].map((c) => (/[",\n]/.test(c) ? `"${c.replace(/"/g, '""')}"` : c)).join(','))].join('\n');

  return (
    <div className="stack">
      <div className="actions">
        <Button variant="ghost" onClick={() => setInv(sampleInvoice())}>
          Load example
        </Button>
        <Button variant="ghost" onClick={() => setInv({ ...blank(), from: inv.from, issued: new Date().toISOString().slice(0, 10) })}>
          New invoice
        </Button>
        <DownloadTextButton text={JSON.stringify(inv, null, 2)} filename={`${stem}.json`} mime="application/json" label="Save data (.json)" />
        <Button variant="ghost" onClick={() => fileRef.current?.click()}>
          Open saved .json
        </Button>
        <input
          ref={fileRef}
          type="file"
          accept=".json,application/json"
          className="visually-hidden-input"
          tabIndex={-1}
          aria-hidden="true"
          onChange={async (e) => {
            const f = e.target.files?.[0];
            e.target.value = '';
            if (!f) return;
            try {
              const j = JSON.parse(await f.text()) as Partial<Invoice>;
              if (!Array.isArray(j.items)) throw new Error('missing items');
              setInv({ ...blank(), ...j, from: { ...emptyParty(), ...j.from }, to: { ...emptyParty(), ...j.to }, items: j.items.map((it) => ({ ...emptyItem(), ...it })) });
              setMsg({ tone: 'success', text: `Opened ${f.name}.` });
            } catch {
              setMsg({ tone: 'error', text: 'That file is not invoice data saved by this tool.' });
            }
          }}
        />
        <CheckboxField label="Remember my business details in this browser" checked={remember} onChange={(v) => { setRemember(v); if (!v) try { localStorage.removeItem(FROM_KEY); } catch { /* blocked */ } }} />
      </div>
      {msg && <Status tone={msg.tone}>{msg.text}</Status>}
      <div className="cv-builder-grid">
        <div className="cv-editor">
          <fieldset className="options">
            <legend>Invoice</legend>
            <TextField label="Invoice number" value={inv.number} onChange={(v) => setInv((x) => ({ ...x, number: v }))} />
            <TextField label="Issue date" type="date" value={inv.issued} onChange={(v) => setInv((x) => ({ ...x, issued: v }))} />
            <TextField label="Due date" type="date" value={inv.due} onChange={(v) => setInv((x) => ({ ...x, due: v }))} />
            <SelectField label="Currency" value={inv.currency} onChange={(v) => setInv((x) => ({ ...x, currency: v }))} options={CURRENCIES.map((c) => ({ value: c, label: c }))} />
            <TextField label="Discount %" value={inv.discount} onChange={(v) => setInv((x) => ({ ...x, discount: v }))} inputMode="decimal" />
            <TextField label="Shipping" value={inv.shipping} onChange={(v) => setInv((x) => ({ ...x, shipping: v }))} inputMode="decimal" />
          </fieldset>
          <PartyFields title="From (you)" p={inv.from} onChange={(p) => setInv((x) => ({ ...x, from: p }))} />
          <PartyFields title="Bill to" p={inv.to} onChange={(p) => setInv((x) => ({ ...x, to: p }))} />
          <div className="inv-items">
            <p className="field-label">Line items</p>
            {inv.items.map((it, i) => (
              <div className="inv-item" key={i}>
                <TextField label="Description" value={it.description} onChange={(v) => setItem(i, { ...it, description: v })} />
                <TextField label="Qty" value={it.qty} onChange={(v) => setItem(i, { ...it, qty: v })} inputMode="decimal" />
                <TextField label="Unit price" value={it.price} onChange={(v) => setItem(i, { ...it, price: v })} inputMode="decimal" />
                <TextField label="Tax %" value={it.tax} onChange={(v) => setItem(i, { ...it, tax: v })} inputMode="decimal" />
                <button type="button" className="icon-btn danger" aria-label={`Remove line ${i + 1}`} onClick={() => setInv((x) => ({ ...x, items: x.items.length > 1 ? x.items.filter((_, j) => j !== i) : [emptyItem()] }))}>
                  ✕
                </button>
              </div>
            ))}
            <Button variant="ghost" onClick={() => setInv((x) => ({ ...x, items: [...x.items, emptyItem()] }))}>
              + Add line
            </Button>
          </div>
          <TextAreaField label="Notes" mono={false} rows={2} value={inv.notes} onChange={(v) => setInv((x) => ({ ...x, notes: v }))} />
          <TextAreaField label="Payment terms / bank details" mono={false} rows={2} value={inv.terms} onChange={(v) => setInv((x) => ({ ...x, terms: v }))} />
        </div>
        <div className="cv-side">
          <fieldset className="options cv-style">
            <legend>Look</legend>
            <SelectField label="Accent" value={accent} onChange={setAccent} options={ACCENTS} />
            <SelectField label="Paper" value={paper} onChange={(v) => setPaper(v as 'a4' | 'letter')} options={[{ value: 'a4', label: 'A4' }, { value: 'letter', label: 'US Letter' }]} />
          </fieldset>
          <div className="actions">
            <Button variant="primary" onClick={() => void pdf()}>
              Download PDF
            </Button>
            <Button onClick={() => sheet.current && printHtml(sheet.current.outerHTML, INVOICE_CSS.replace(/var\(--inv-accent\)/g, accent), `Invoice ${inv.number}`, paper, '14mm')}>Print / Save as PDF</Button>
            <DownloadTextButton text={csv} filename={`${stem}.csv`} mime="text/csv" label="Items (.csv)" />
          </div>
          {t.errors.map((e) => (
            <Status key={e} tone="warn">
              {e}
            </Status>
          ))}
          <div className="cv-preview-wrap">
            <div className="inv-sheet" ref={sheet} style={{ ['--inv-accent' as string]: accent }}>
              <div className="inv-top">
                <div>
                  <strong className="inv-from">{inv.from.name || 'Your business'}</strong>
                  {[...inv.from.address.split('\n'), inv.from.email, inv.from.phone, inv.from.taxId].filter((x) => x.trim()).map((l, i) => (
                    <div key={i} className="inv-muted">
                      {l}
                    </div>
                  ))}
                </div>
                <div className="inv-meta">
                  <div className="inv-title">INVOICE</div>
                  {inv.number && <div><span>Invoice no.</span> <b>{inv.number}</b></div>}
                  {inv.issued && <div><span>Issued</span> <b>{inv.issued}</b></div>}
                  {inv.due && <div><span>Due</span> <b>{inv.due}</b></div>}
                </div>
              </div>
              <div className="inv-to">
                <div className="inv-label">Bill to</div>
                <strong>{inv.to.name || '—'}</strong>
                {[...inv.to.address.split('\n'), inv.to.email, inv.to.phone, inv.to.taxId].filter((x) => x.trim()).map((l, i) => (
                  <div key={i} className="inv-muted">
                    {l}
                  </div>
                ))}
              </div>
              <table className="inv-table">
                <thead>
                  <tr>
                    <th>Description</th>
                    <th>Qty</th>
                    <th>Unit price</th>
                    <th>Tax</th>
                    <th>Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {inv.items.map((it, i) =>
                    it.description.trim() || it.price.trim() ? (
                      <tr key={i}>
                        <td>{it.description}</td>
                        <td>{it.qty}</td>
                        <td>{Number.isFinite(num(it.price || '0')) ? fmt(Math.round(num(it.price || '0') * 10 ** t.digits)) : '?'}</td>
                        <td>{it.tax || 0}%</td>
                        <td>{fmt(t.lines[i].amount)}</td>
                      </tr>
                    ) : null,
                  )}
                </tbody>
              </table>
              <table className="inv-totals">
                <tbody>
                  <tr><td>Subtotal</td><td>{fmt(t.subtotal)}</td></tr>
                  {t.discount > 0 && <tr><td>Discount ({inv.discount}%)</td><td>−{fmt(t.discount)}</td></tr>}
                  {t.tax > 0 && <tr><td>Tax</td><td>{fmt(t.tax)}</td></tr>}
                  {t.shipping > 0 && <tr><td>Shipping</td><td>{fmt(t.shipping)}</td></tr>}
                  <tr className="inv-grand"><td>Total due ({inv.currency})</td><td>{fmt(t.total)}</td></tr>
                </tbody>
              </table>
              {inv.notes.trim() && (
                <div className="inv-note">
                  <div className="inv-label">Notes</div>
                  <div className="inv-muted" dangerouslySetInnerHTML={{ __html: esc(inv.notes).replace(/\n/g, '<br>') }} />
                </div>
              )}
              {inv.terms.trim() && (
                <div className="inv-note">
                  <div className="inv-label">Payment terms</div>
                  <div className="inv-muted" dangerouslySetInnerHTML={{ __html: esc(inv.terms).replace(/\n/g, '<br>') }} />
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/** Styles used both on screen (via globals.css) and in the print iframe. */
const INVOICE_CSS = `
.inv-sheet{font:10pt/1.45 'Helvetica Neue',Helvetica,Arial,sans-serif;color:#1b1b1f;background:#fff}
.inv-top{display:flex;justify-content:space-between;gap:16px;margin-bottom:18px}
.inv-from{font-size:14pt}
.inv-muted{color:#5a5a62}
.inv-meta{text-align:right}
.inv-meta span{color:#5a5a62}
.inv-title{font-size:22pt;font-weight:700;color:var(--inv-accent);letter-spacing:.04em;margin-bottom:4px}
.inv-to{margin-bottom:16px}
.inv-label{font-size:8pt;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:var(--inv-accent)}
.inv-table{width:100%;border-collapse:collapse;margin-bottom:10px}
.inv-table th{background:var(--inv-accent);color:#fff;text-align:right;padding:5px 6px;font-size:9pt}
.inv-table th:first-child,.inv-table td:first-child{text-align:left}
.inv-table td{padding:5px 6px;border-bottom:1px solid #e3e3e6;text-align:right;vertical-align:top}
.inv-totals{margin-left:auto;border-collapse:collapse;min-width:45%}
.inv-totals td{padding:3px 6px;text-align:right}
.inv-totals td:first-child{color:#5a5a62}
.inv-grand td{font-weight:700;font-size:11pt;color:#111!important;border-top:1.5px solid var(--inv-accent);padding-top:6px}
.inv-note{margin-top:14px}
`;
