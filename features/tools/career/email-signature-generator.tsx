'use client';

import { useMemo, useRef, useState } from 'react';
import { Button, CopyButton } from '@/components/tool-kit/actions';
import { SelectField, Status, TextField } from '@/components/tool-kit/fields';
import { signatureHtml, signatureText, type SignatureFields } from './job-logic';
import { ACCENT_CHOICES } from './CvExports';
import { loadDraft } from './cv-storage';

const EMPTY: SignatureFields = { name: '', title: '', company: '', phone: '', email: '', website: '', linkedin: '', address: '', accent: '#b3263e', font: 'Arial, Helvetica, sans-serif', layout: 'divider' };

export default function EmailSignatureGenerator() {
  const [f, setF] = useState<SignatureFields>(EMPTY);
  const [state, setState] = useState<{ tone: 'success' | 'warn' | 'info'; text: string } | null>(null);
  const preview = useRef<HTMLDivElement>(null);
  const set = (k: keyof SignatureFields) => (v: string) => setF((x) => ({ ...x, [k]: v }));
  const html = useMemo(() => signatureHtml(f), [f]);
  const text = useMemo(() => signatureText(f), [f]);

  const copyRich = async () => {
    try {
      if (typeof ClipboardItem !== 'undefined' && navigator.clipboard?.write) {
        await navigator.clipboard.write([new ClipboardItem({ 'text/html': new Blob([html], { type: 'text/html' }), 'text/plain': new Blob([text], { type: 'text/plain' }) })]);
        setState({ tone: 'success', text: 'Signature copied — paste it into your email app’s signature settings.' });
        return;
      }
    } catch {
      /* fall back to selecting the preview */
    }
    const el = preview.current;
    if (el) {
      const range = document.createRange();
      range.selectNodeContents(el);
      const sel = window.getSelection();
      sel?.removeAllRanges();
      sel?.addRange(range);
    }
    setState({ tone: 'warn', text: 'Your browser blocked copying. The signature is selected — press Ctrl/⌘ + C.' });
  };

  return (
    <div className="tool-grid">
      <div className="tool-col">
        <div className="actions">
          <Button variant="ghost" onClick={() => setF({ ...EMPTY, name: 'Aisha Khan', title: 'Senior Frontend Engineer', company: 'Northwind Labs', phone: '+49 151 2345 6789', email: 'aisha.khan@example.com', website: 'northwind.example', linkedin: 'linkedin.com/in/aishakhan', address: 'Berlin, Germany' })}>
            Load example
          </Button>
          <Button
            variant="ghost"
            onClick={() => {
              const d = loadDraft();
              if (!d) return setState({ tone: 'info', text: 'No CV Builder draft was found in this browser.' });
              setF((x) => ({ ...x, name: d.basics.name, title: d.basics.label, phone: d.basics.phone, email: d.basics.email, website: d.basics.website, linkedin: d.basics.linkedin, address: d.basics.location }));
            }}
          >
            Fill from my CV draft
          </Button>
          <Button variant="ghost" onClick={() => setF(EMPTY)}>
            Reset
          </Button>
        </div>
        <fieldset className="options">
          <legend>Details</legend>
          <TextField label="Name" value={f.name} onChange={set('name')} />
          <TextField label="Job title" value={f.title} onChange={set('title')} />
          <TextField label="Company" value={f.company} onChange={set('company')} />
          <TextField label="Phone" value={f.phone} onChange={set('phone')} />
          <TextField label="Email" value={f.email} onChange={set('email')} />
          <TextField label="Website" value={f.website} onChange={set('website')} />
          <TextField label="LinkedIn" value={f.linkedin} onChange={set('linkedin')} />
          <TextField label="Address / city" value={f.address} onChange={set('address')} />
        </fieldset>
        <fieldset className="options">
          <legend>Style</legend>
          <SelectField label="Layout" value={f.layout} onChange={(v) => setF((x) => ({ ...x, layout: v as SignatureFields['layout'] }))} options={[{ value: 'divider', label: 'Two columns with divider' }, { value: 'stacked', label: 'Stacked' }, { value: 'compact', label: 'Compact (two lines)' }]} />
          <SelectField label="Accent" value={f.accent} onChange={set('accent')} options={ACCENT_CHOICES} />
          <SelectField
            label="Font"
            value={f.font}
            onChange={set('font')}
            options={[
              { value: 'Arial, Helvetica, sans-serif', label: 'Arial' },
              { value: 'Verdana, Geneva, sans-serif', label: 'Verdana' },
              { value: "Georgia, 'Times New Roman', serif", label: 'Georgia' },
              { value: "Tahoma, 'Segoe UI', sans-serif", label: 'Tahoma' },
            ]}
          />
        </fieldset>
      </div>
      <div className="tool-col">
        <p className="field-label">Preview</p>
        <div className="sig-preview" ref={preview} dangerouslySetInnerHTML={{ __html: html }} />
        <div className="actions">
          <Button variant="primary" onClick={() => void copyRich()}>
            Copy signature
          </Button>
          <CopyButton text={html} label="Copy HTML code" />
          <CopyButton text={text} label="Copy plain text" />
        </div>
        {state && <Status tone={state.tone}>{state.text}</Status>}
        <p className="field-hint">Gmail: Settings → See all settings → Signature → paste. Outlook: Settings → Mail → Compose and reply → paste. The HTML uses tables and inline styles, which email apps keep. All text is escaped, so nothing you type can run as code.</p>
      </div>
    </div>
  );
}
