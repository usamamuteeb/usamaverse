'use client';

import { useMemo, useState } from 'react';
import { Button } from '@/components/tool-kit/actions';
import { Status, TextAreaField } from '@/components/tool-kit/fields';
import { ResultRows } from '@/components/tool-kit/output';
import { DEFAULT_SCALE, gpa, parseScale } from './more';

const DEFAULT_TEXT = DEFAULT_SCALE.map((s) => `${s.grade} = ${s.points}`).join('\n');
const blank = () => ({ name: '', credits: '', grade: '' });

export default function GpaCalculator() {
  const [rows, setRows] = useState([{ name: 'Course 1', credits: '3', grade: 'A' }, { name: 'Course 2', credits: '4', grade: 'B+' }, blank(), blank()]);
  const [scaleText, setScaleText] = useState(DEFAULT_TEXT);
  const outcome = useMemo(() => {
    try {
      return { r: gpa(rows, parseScale(scaleText)), e: null as string | null };
    } catch (e) {
      return { r: null, e: e instanceof Error ? e.message : String(e) };
    }
  }, [rows, scaleText]);
  const update = (i: number, k: 'name' | 'credits' | 'grade', v: string) => setRows((rs) => rs.map((r, j) => (j === i ? { ...r, [k]: v } : r)));

  return (
    <div className="tool-grid">
      <div className="tool-col">
        <div className="table-scroll">
          <table className="data-table grid-editor">
            <caption>Courses</caption>
            <thead>
              <tr>
                <th scope="col">Course (optional)</th>
                <th scope="col">Credits</th>
                <th scope="col">Grade</th>
                <th scope="col"><span className="sr-only">Remove</span></th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={i}>
                  <td><input className="input" aria-label={`Course ${i + 1} name`} value={r.name} onChange={(e) => update(i, 'name', e.target.value)} /></td>
                  <td><input className="input" aria-label={`Course ${i + 1} credits`} inputMode="decimal" value={r.credits} onChange={(e) => update(i, 'credits', e.target.value)} /></td>
                  <td><input className="input" aria-label={`Course ${i + 1} grade`} value={r.grade} onChange={(e) => update(i, 'grade', e.target.value)} /></td>
                  <td>
                    <Button variant="ghost" onClick={() => setRows((rs) => rs.filter((_, j) => j !== i))} ariaLabel={`Remove course ${i + 1}`} disabled={rows.length <= 1}>
                      ✕
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="actions">
          <Button onClick={() => setRows((rs) => [...rs, blank()])}>Add course</Button>
          <Button variant="ghost" onClick={() => { setRows([blank(), blank(), blank()]); setScaleText(DEFAULT_TEXT); }}>
            Reset
          </Button>
        </div>
      </div>
      <div className="tool-col">
        {outcome.e && <Status tone="error">{outcome.e}</Status>}
        {outcome.r ? (
          <ResultRows
            rows={[
              { label: 'GPA', value: outcome.r.gpa.toFixed(2), emphasis: true },
              { label: 'Total credits', value: String(outcome.r.credits) },
              { label: 'Quality points', value: outcome.r.qualityPoints.toFixed(2) },
              { label: 'Courses counted', value: String(outcome.r.courses) },
            ]}
          />
        ) : (
          !outcome.e && <p className="empty-state">Enter credits and grades.</p>
        )}
        <TextAreaField label="Grade scale (edit to match your institution)" value={scaleText} onChange={setScaleText} rows={8} hint="One per line, like “A = 4.0”. Grades can also be typed as numbers directly." />
      </div>
    </div>
  );
}
