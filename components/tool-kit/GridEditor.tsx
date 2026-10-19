'use client';

import { Button } from './actions';

export function GridEditor({ grid, onChange, headerRow = true }: { grid: string[][]; onChange: (g: string[][]) => void; headerRow?: boolean }) {
  const cols = grid[0]?.length ?? 0;
  const set = (r: number, c: number, v: string) => onChange(grid.map((row, i) => (i === r ? row.map((x, j) => (j === c ? v : x)) : row)));
  return (
    <div className="stack">
      <div className="table-scroll">
        <table className="grid-editor">
          <tbody>
            {grid.map((row, r) => (
              <tr key={r}>
                {row.map((cell, c) => (
                  <td key={c}>
                    <input className="input" aria-label={`${headerRow && r === 0 ? 'Header' : `Row ${headerRow ? r : r + 1}`}, column ${c + 1}`} value={cell} onChange={(e) => set(r, c, e.target.value)} />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="actions">
        <Button onClick={() => onChange([...grid, Array(cols).fill('')])} disabled={grid.length >= 200}>Add row</Button>
        <Button onClick={() => onChange(grid.map((r) => [...r, '']))} disabled={cols >= 20}>Add column</Button>
        <Button variant="ghost" onClick={() => onChange(grid.slice(0, -1))} disabled={grid.length <= 1}>Remove last row</Button>
        <Button variant="ghost" onClick={() => onChange(grid.map((r) => r.slice(0, -1)))} disabled={cols <= 1}>Remove last column</Button>
      </div>
    </div>
  );
}

/** Paste tab- or comma-separated text into a grid. */
export function textToGrid(text: string): string[][] {
  const lines = text.replace(/\r\n?/g, '\n').split('\n').filter((l) => l.trim() !== '');
  if (!lines.length) return [['']];
  const sep = lines[0].includes('\t') ? '\t' : ',';
  const rows = lines.map((l) => l.split(sep).map((c) => c.trim()));
  const cols = Math.max(...rows.map((r) => r.length));
  return rows.map((r) => Array.from({ length: cols }, (_, i) => r[i] ?? ''));
}
