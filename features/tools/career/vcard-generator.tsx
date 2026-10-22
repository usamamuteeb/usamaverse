'use client';

import { useMemo, useState } from 'react';
import { Button, CopyButton, DownloadTextButton } from '@/components/tool-kit/actions';
import { Status, TextAreaField, TextField } from '@/components/tool-kit/fields';
import { downloadBlob } from '@/lib/tools/shared/download';
import { encodeQr, qrToSvg } from '@/features/tools/generators/qr';
import { buildVCard, type VCardFields } from './job-logic';
import { loadDraft } from './cv-storage';

const EMPTY: VCardFields = { first: '', last: '', org: '', title: '', mobile: '', work: '', email: '', website: '', street: '', city: '', region: '', postcode: '', country: '', birthday: '', note: '' };

async function svgToPng(svg: string, px: number): Promise<Blob> {
  const img = new Image();
  const url = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml' }));
  try {
    await new Promise<void>((res, rej) => {
      img.onload = () => res();
      img.onerror = () => rej(new Error('The QR image could not be drawn.'));
      img.src = url;
    });
    const c = document.createElement('canvas');
    c.width = c.height = px;
    const ctx = c.getContext('2d')!;
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(img, 0, 0, px, px);
    return await new Promise<Blob>((res, rej) => c.toBlob((b) => (b ? res(b) : rej(new Error('PNG export failed.'))), 'image/png'));
  } finally {
    URL.revokeObjectURL(url);
  }
}

export default function VCardGenerator() {
  const [f, setF] = useState<VCardFields>(EMPTY);
  const [msg, setMsg] = useState<string | null>(null);
  const set = (k: keyof VCardFields) => (v: string) => setF((x) => ({ ...x, [k]: v }));
  const out = useMemo(() => {
    if (!Object.values(f).some((v) => v.trim())) return null;
    try {
      const vcf = buildVCard(f);
      let svg = '';
      let qrError = '';
      try {
        svg = qrToSvg(encodeQr(vcf, 'M'), { quiet: 4, dark: '#000000', light: '#ffffff' });
      } catch (e) {
        qrError = e instanceof Error ? e.message : String(e);
      }
      return { vcf, svg, qrError, error: '' };
    } catch (e) {
      return { vcf: '', svg: '', qrError: '', error: e instanceof Error ? e.message : String(e) };
    }
  }, [f]);
  const stem = ([f.first, f.last].filter((x) => x.trim()).join('-') || f.org || 'contact').toLowerCase().replace(/[^a-z0-9]+/g, '-');

  return (
    <div className="tool-grid">
      <div className="tool-col">
        <div className="actions">
          <Button variant="ghost" onClick={() => setF({ ...EMPTY, first: 'Aisha', last: 'Khan', org: 'Northwind Labs', title: 'Senior Frontend Engineer', mobile: '+49 151 2345 6789', email: 'aisha.khan@example.com', website: 'aishakhan.dev', city: 'Berlin', country: 'Germany' })}>
            Load example
          </Button>
          <Button
            variant="ghost"
            onClick={() => {
              const d = loadDraft();
              if (!d) return setMsg('No CV Builder draft was found in this browser.');
              const parts = d.basics.name.trim().split(/\s+/);
              const last = parts.length > 1 ? parts.pop()! : '';
              const [city, ...rest] = d.basics.location.split(/\s*,\s*/);
              setF((x) => ({ ...x, first: parts.join(' '), last, title: d.basics.label, mobile: d.basics.phone, email: d.basics.email, website: d.basics.website || d.basics.linkedin, city: city ?? '', country: rest.join(', ') }));
              setMsg('Filled from your CV Builder draft.');
            }}
          >
            Fill from my CV draft
          </Button>
          <Button variant="ghost" onClick={() => setF(EMPTY)}>
            Reset
          </Button>
        </div>
        {msg && <Status tone="info">{msg}</Status>}
        <fieldset className="options">
          <legend>Person</legend>
          <TextField label="First name" value={f.first} onChange={set('first')} />
          <TextField label="Last name" value={f.last} onChange={set('last')} />
          <TextField label="Organisation" value={f.org} onChange={set('org')} />
          <TextField label="Job title" value={f.title} onChange={set('title')} />
          <TextField label="Mobile" value={f.mobile} onChange={set('mobile')} />
          <TextField label="Work phone" value={f.work} onChange={set('work')} />
          <TextField label="Email" value={f.email} onChange={set('email')} />
          <TextField label="Website" value={f.website} onChange={set('website')} />
          <TextField label="Birthday" type="date" value={f.birthday} onChange={set('birthday')} />
        </fieldset>
        <fieldset className="options">
          <legend>Address</legend>
          <TextField label="Street" value={f.street} onChange={set('street')} />
          <TextField label="City" value={f.city} onChange={set('city')} />
          <TextField label="Region / state" value={f.region} onChange={set('region')} />
          <TextField label="Postcode" value={f.postcode} onChange={set('postcode')} />
          <TextField label="Country" value={f.country} onChange={set('country')} />
        </fieldset>
        <TextAreaField label="Note (optional)" mono={false} rows={2} value={f.note} onChange={set('note')} />
      </div>
      <div className="tool-col">
        {out?.error && <Status tone="error">{out.error}</Status>}
        {out?.vcf ? (
          <>
            <div className="qr-preview">{out.svg ? <img src={`data:image/svg+xml;charset=utf-8,${encodeURIComponent(out.svg)}`} alt="QR code containing this contact card" /> : <p className="muted">{out.qrError}</p>}</div>
            <div className="actions">
              <DownloadTextButton text={out.vcf} filename={`${stem}.vcf`} mime="text/vcard" label="Download .vcf" />
              <Button onClick={async () => out.svg && downloadBlob(await svgToPng(out.svg, 1024), `${stem}-qr.png`)} disabled={!out.svg}>
                QR as PNG
              </Button>
              <DownloadTextButton text={out.svg} filename={`${stem}-qr.svg`} mime="image/svg+xml" label="QR as SVG" />
              <CopyButton text={out.vcf} label="Copy vCard" />
            </div>
            <TextAreaField label="vCard 3.0 text" value={out.vcf} readOnly rows={10} />
            <p className="field-hint">Phones open .vcf files in their contacts app; scanning the QR code adds the contact directly. Long notes or addresses make the QR code denser and harder to scan.</p>
          </>
        ) : (
          <p className="empty-state">Fill in a name to create the contact card and its QR code.</p>
        )}
      </div>
    </div>
  );
}
