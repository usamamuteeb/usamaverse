'use client';

import { useEffect, useState } from 'react';
import { Button, DownloadBlobButton } from '@/components/tool-kit/actions';
import { CheckboxField, SelectField, Status, TextAreaField, TextField } from '@/components/tool-kit/fields';
import { formatBytes } from '@/lib/format';
import { pdfBlob, useSinglePdf } from '@/features/tools/files/usePdf';
import { fillForm, readForm, type FieldInfo, type FieldValue } from './ops';
import { ResultPreview } from './PageGrid';

export default function PdfForms() {
  const { pdf, picker } = useSinglePdf();
  const [info, setInfo] = useState<{ fields: FieldInfo[]; hasXfa: boolean; signed: boolean } | null>(null);
  const [values, setValues] = useState<Record<string, FieldValue>>({});
  const [flatten, setFlatten] = useState(false);
  const [out, setOut] = useState<Uint8Array | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setInfo(null);
    setOut(null);
    setError(null);
    if (!pdf) return;
    readForm(pdf.bytes)
      .then((r) => {
        setInfo(r);
        const v: Record<string, FieldValue> = {};
        for (const f of r.fields) {
          if (f.kind === 'text' || f.kind === 'radio' || f.kind === 'dropdown') v[f.name] = f.value;
          else if (f.kind === 'checkbox') v[f.name] = f.checked;
          else if (f.kind === 'list') v[f.name] = f.values;
        }
        setValues(v);
      })
      .catch((e) => setError(e instanceof Error ? e.message : String(e)));
  }, [pdf]);

  const set = (name: string, v: FieldValue) => {
    setValues((p) => ({ ...p, [name]: v }));
    setOut(null);
  };
  const fillable = info?.fields.filter((f) => f.kind !== 'other') ?? [];

  return (
    <div className="tool-grid">
      <div className="tool-col">
        {picker}
        {info && (
          <>
            {info.hasXfa && <Status tone="warn">This PDF contains an XFA form. Only its standard (AcroForm) fields can be filled here; the XFA layer is removed when you save so viewers show your values.</Status>}
            {info.signed && <Status tone="warn">This PDF has a digital signature. Saving changes will invalidate it.</Status>}
            {fillable.length === 0 ? (
              <Status tone="info">No fillable form fields were found. To type on a flat PDF, use Edit PDF instead.</Status>
            ) : (
              <form className="stack" onSubmit={(e) => e.preventDefault()}>
                <p className="summary">{fillable.length} field{fillable.length === 1 ? '' : 's'} found.</p>
                {fillable.map((f) => {
                  const label = `${f.name}${f.readOnly ? ' (read-only)' : ''}`;
                  if (f.kind === 'text')
                    return f.multiline ? (
                      <TextAreaField key={f.name} label={label} value={String(values[f.name] ?? '')} onChange={(v) => set(f.name, v)} rows={3} mono={false} />
                    ) : (
                      <TextField key={f.name} label={label} value={String(values[f.name] ?? '')} onChange={(v) => set(f.name, f.maxLength ? v.slice(0, f.maxLength) : v)} hint={f.maxLength ? `Up to ${f.maxLength} characters` : undefined} />
                    );
                  if (f.kind === 'checkbox') return <CheckboxField key={f.name} label={label} checked={Boolean(values[f.name])} onChange={(v) => set(f.name, v)} />;
                  if (f.kind === 'radio' || f.kind === 'dropdown')
                    return <SelectField key={f.name} label={label} value={String(values[f.name] ?? '')} onChange={(v) => set(f.name, v)} options={[{ value: '', label: '— none —' }, ...f.options.map((o) => ({ value: o, label: o }))]} />;
                  if (f.kind === 'list')
                    return (
                      <fieldset key={f.name} className="options">
                        <legend className="field-label">{label}</legend>
                        {f.options.map((o) => {
                          const cur = (values[f.name] as string[]) ?? [];
                          return <CheckboxField key={o} label={o} checked={cur.includes(o)} onChange={(on) => set(f.name, on ? (f.multi ? [...cur, o] : [o]) : cur.filter((x) => x !== o))} />;
                        })}
                      </fieldset>
                    );
                  return null;
                })}
                <CheckboxField label="Flatten (make the answers part of the page so they can’t be edited)" checked={flatten} onChange={(v) => { setFlatten(v); setOut(null); }} />
                <Button
                  variant="primary"
                  disabled={busy}
                  onClick={async () => {
                    setBusy(true);
                    setError(null);
                    try {
                      setOut(await fillForm(pdf!.bytes, values, { flatten }));
                    } catch (e) {
                      setError(e instanceof Error ? e.message : String(e));
                    } finally {
                      setBusy(false);
                    }
                  }}
                >
                  {busy ? 'Saving…' : 'Save filled PDF'}
                </Button>
              </form>
            )}
          </>
        )}
      </div>
      <div className="tool-col">
        {error && <Status tone="error">{error}</Status>}
        {!out && !error && <p className="empty-state">Fill in standard PDF form fields (text boxes, checkboxes, choices) without uploading the document. Built-in fonts support Latin characters.</p>}
        {out && pdf && (
          <>
            <ResultPreview bytes={out} />
            <DownloadBlobButton blob={pdfBlob(out)} filename={`${pdf.base}-filled.pdf`} label={`Download PDF (${formatBytes(out.length)})`} />
          </>
        )}
      </div>
    </div>
  );
}
