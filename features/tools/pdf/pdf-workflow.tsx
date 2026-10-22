'use client';

import { useEffect, useState } from 'react';
import { Button, DownloadBlobButton, DownloadTextButton } from '@/components/tool-kit/actions';
import { FileDrop } from '@/components/tool-kit/files';
import { SelectField, Status, TextField } from '@/components/tool-kit/fields';
import { formatBytes } from '@/lib/format';
import { pdfBlob, useSinglePdf } from '@/features/tools/files/usePdf';
import { ResultPreview } from './PageGrid';
import { defaultWorkflowStep, parseWorkflowRecipe, runPdfWorkflow, type StepKind, type WorkflowStep } from './workflow';

const STORE_KEY = 'usamaverse:v1:pdf-workflow';
const KINDS: Array<{ value: StepKind; label: string }> = [
  { value: 'rotate', label: 'Rotate pages' }, { value: 'remove', label: 'Remove pages' },
  { value: 'numbers', label: 'Add page numbers' }, { value: 'watermark', label: 'Text watermark' },
  { value: 'metadata', label: 'Set title and author' }, { value: 'optimize', label: 'Lossless optimize' },
];

export default function PdfWorkflow() {
  const { pdf, picker } = useSinglePdf();
  const [steps, setSteps] = useState<WorkflowStep[]>([defaultWorkflowStep('numbers')]);
  const [kind, setKind] = useState<StepKind>('watermark');
  const [out, setOut] = useState<Uint8Array | null>(null);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState('');
  const [status, setStatus] = useState('');
  const [error, setError] = useState('');
  useEffect(() => { try { const saved = localStorage.getItem(STORE_KEY); if (saved) setSteps(parseWorkflowRecipe(saved)); } catch { /* ignore invalid or blocked storage */ } }, []);
  const change = (next: WorkflowStep[]) => { setSteps(next); setOut(null); setError(''); };
  const patch = (i: number, values: Record<string, string | number>) => change(steps.map((s, j) => j === i ? { ...s, ...values } as WorkflowStep : s));
  const move = (i: number, delta: number) => { const copy = [...steps]; const [step] = copy.splice(i, 1); copy.splice(i + delta, 0, step); change(copy); };
  return <div className="tool-grid">
    <div className="tool-col">
      {picker}
      <div className="field-row"><SelectField label="Add action" value={kind} onChange={(v) => setKind(v as StepKind)} options={KINDS} /><div className="field workflow-add"><Button onClick={() => change([...steps, defaultWorkflowStep(kind)])} disabled={steps.length >= 20}>Add step</Button></div></div>
      <div className="workflow-steps">{steps.map((s, i) => <section className="workflow-step" key={i}>
        <div className="workflow-head"><strong>{i + 1}. {KINDS.find((x) => x.value === s.kind)?.label}</strong><div className="actions"><Button variant="ghost" disabled={i === 0} onClick={() => move(i, -1)} ariaLabel={`Move step ${i + 1} up`}>↑</Button><Button variant="ghost" disabled={i === steps.length - 1} onClick={() => move(i, 1)} ariaLabel={`Move step ${i + 1} down`}>↓</Button><Button variant="ghost" onClick={() => change(steps.filter((_, j) => j !== i))} ariaLabel={`Remove step ${i + 1}`}>×</Button></div></div>
        {'pages' in s && <TextField label="Pages" value={s.pages} onChange={(v) => patch(i, { pages: v })} hint="all, 1-3, 5, last; page references follow the order above" />}
        {s.kind === 'rotate' && <SelectField label="Clockwise rotation" value={String(s.angle)} onChange={(v) => patch(i, { angle: Number(v) })} options={[{ value: '90', label: '90°' }, { value: '180', label: '180°' }, { value: '270', label: '270°' }]} />}
        {s.kind === 'numbers' && <TextField label="First number" value={String(s.startAt)} onChange={(v) => patch(i, { startAt: Number(v) })} type="number" min={0} />}
        {s.kind === 'watermark' && <div className="field-row"><TextField label="Watermark text" value={s.text} onChange={(v) => patch(i, { text: v })} /><TextField label="Color" type="color" value={s.color} onChange={(v) => patch(i, { color: v })} /><TextField label="Opacity (%)" type="number" min={1} max={100} value={String(Math.round(s.opacity * 100))} onChange={(v) => patch(i, { opacity: Number(v) / 100 })} /></div>}
        {s.kind === 'metadata' && <div className="field-row"><TextField label="Title (leave blank to keep)" value={s.title} onChange={(v) => patch(i, { title: v })} /><TextField label="Author (leave blank to keep)" value={s.author} onChange={(v) => patch(i, { author: v })} /></div>}
        {s.kind === 'optimize' && <p className="field-hint">Re-saves the PDF and keeps the smaller file. The result may remain the same size.</p>}
      </section>)}</div>
      <div className="actions"><Button variant="primary" disabled={!pdf || !steps.length || busy} onClick={async () => { if (!pdf) return; setBusy(true); setError(''); setOut(null); setProgress('Starting…'); try { const result = await runPdfWorkflow(pdf.bytes, steps, (index) => setProgress(`Running step ${index + 1} of ${steps.length}…`)); setOut(result); setProgress('Recipe complete.'); } catch (e) { setError(e instanceof Error ? e.message : String(e)); setProgress(''); } finally { setBusy(false); } }}>{busy ? 'Running…' : 'Run recipe on PDF'}</Button><Button variant="ghost" disabled={!steps.length} onClick={() => { try { const recipe = JSON.stringify(parseWorkflowRecipe(JSON.stringify(steps))); localStorage.setItem(STORE_KEY, recipe); setStatus('Recipe saved on this device.'); } catch (e) { setError(e instanceof Error ? e.message : String(e)); } }}>Save recipe here</Button><DownloadTextButton text={JSON.stringify(steps, null, 2)} filename="pdf-recipe.json" mime="application/json" label="Export recipe" /></div>
      <FileDrop accept="application/json,.json" label="Import recipe JSON" onFiles={async ([file]) => { setError(''); try { if (file.size > 100_000) throw new Error('Recipe file is too large.'); change(parseWorkflowRecipe(await file.text())); setStatus('Recipe imported.'); } catch (e) { setError(e instanceof Error ? e.message : String(e)); } }} />
      <p className="field-hint">Recipes contain settings only; the PDF is never stored. Steps run in order, so removing pages changes later page numbers. Use the dedicated editor for direct text or image edits.</p>
    </div>
    <div className="tool-col">
      {status && <Status tone="success">{status}</Status>}{progress && <Status tone="info">{progress}</Status>}{error && <Status tone="error">{error}</Status>}
      {out && pdf && <><ResultPreview bytes={out} /><DownloadBlobButton blob={pdfBlob(out)} filename={`${pdf.base}-workflow.pdf`} label={`Download PDF (${formatBytes(out.length)})`} /></>}
    </div>
  </div>;
}
