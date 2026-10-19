/** Display a number with up to 12 significant digits, without float noise like 0.30000000000000004. */
export function formatNumber(n: number, maxSig = 12): string {
  if (!Number.isFinite(n)) return n > 0 ? '∞' : n < 0 ? '−∞' : 'Not a number';
  if (n === 0) return '0';
  const r = Number(n.toPrecision(maxSig));
  const abs = Math.abs(r);
  if (abs >= 1e21 || abs < 1e-7) return r.toExponential().replace('e+', 'e');
  return r.toLocaleString('en-US', { maximumFractionDigits: 20, useGrouping: false });
}

/** Group digits for readability (display only). */
export function formatGrouped(n: number, maxFraction = 2): string {
  if (!Number.isFinite(n)) return formatNumber(n);
  return n.toLocaleString('en-US', { maximumFractionDigits: maxFraction, minimumFractionDigits: 0 });
}

export function formatMoney(n: number): string {
  if (!Number.isFinite(n)) return formatNumber(n);
  return n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

const DEC = ['B', 'kB', 'MB', 'GB', 'TB'];
const BIN = ['B', 'KiB', 'MiB', 'GiB', 'TiB'];

export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes < 0) return '—';
  const pick = (base: number, units: string[]) => {
    let v = bytes;
    let i = 0;
    while (v >= base && i < units.length - 1) {
      v /= base;
      i++;
    }
    return i === 0 ? `${v} ${units[0]}` : `${v.toFixed(v < 10 ? 2 : 1)} ${units[i]}`;
  };
  const d = pick(1000, DEC);
  const b = pick(1024, BIN);
  return d === b ? d : `${d} (${b})`;
}

export function pluralize(n: number, one: string, many = `${one}s`): string {
  return `${n.toLocaleString('en-US')} ${n === 1 ? one : many}`;
}
