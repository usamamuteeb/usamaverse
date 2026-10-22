import type { Overlay } from './ops';

export type Point = { x: number; y: number };
export type Bounds = { x: number; y: number; width: number; height: number };

/** Approximate visual bounds used for selecting additions in the editor. */
export function overlayBounds(item: Overlay): Bounds {
  if (item.kind === 'rect' || item.kind === 'image') return { x: item.x, y: item.y, width: item.width, height: item.height };
  if (item.kind === 'ink') {
    const xs = item.points.map(([x]) => x);
    const ys = item.points.map(([, y]) => y);
    return { x: Math.min(...xs), y: Math.min(...ys), width: Math.max(...xs) - Math.min(...xs), height: Math.max(...ys) - Math.min(...ys) };
  }
  const lines = item.text.split(/\r?\n/);
  return {
    x: item.x,
    y: item.y - (lines.length - 1) * item.size * 1.2 - item.size * 0.25,
    width: Math.max(10, ...lines.map((line) => line.length * item.size * 0.62)),
    height: (lines.length - 1) * item.size * 1.2 + item.size * 1.3,
  };
}

export function hitOverlay(items: Overlay[], page: number, point: Point): number | null {
  for (let i = items.length - 1; i >= 0; i--) {
    if (items[i].page !== page) continue;
    const b = overlayBounds(items[i]);
    const pad = 7;
    if (point.x >= b.x - pad && point.x <= b.x + b.width + pad && point.y >= b.y - pad && point.y <= b.y + b.height + pad) return i;
  }
  return null;
}

export function moveOverlay(item: Overlay, dx: number, dy: number): Overlay {
  if (item.kind === 'ink') return { ...item, points: item.points.map(([x, y]) => [x + dx, y + dy]) };
  return { ...item, x: item.x + dx, y: item.y + dy };
}
