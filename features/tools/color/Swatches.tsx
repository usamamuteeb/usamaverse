'use client';

import { CopyButton } from '@/components/tool-kit/actions';
import { contrastRatio, parseColor, rgbToHsl } from './logic';

export function Swatches({ colors }: { colors: string[] }) {
  const white = parseColor('#fff')!;
  const black = parseColor('#000')!;
  return (
    <ul className="swatches" aria-label="Colors">
      {colors.map((hex, i) => {
        const c = parseColor(hex)!;
        const { h, s, l } = rgbToHsl(c.r, c.g, c.b);
        const onWhite = contrastRatio(c, white);
        const onBlack = contrastRatio(c, black);
        return (
          <li key={`${hex}-${i}`} className="swatch">
            <span className="swatch-chip" style={{ background: hex }} aria-hidden="true" />
            <span className="swatch-meta">
              <strong className="mono">{hex}</strong>
              <span className="muted mono">hsl({h} {s}% {l}%)</span>
              <span className="muted">Best text: {onWhite >= onBlack ? `white (${onWhite.toFixed(1)}:1)` : `black (${onBlack.toFixed(1)}:1)`}</span>
              <CopyButton text={hex} />
            </span>
          </li>
        );
      })}
    </ul>
  );
}
