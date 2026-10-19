'use client';

import { UnitConverter } from '@/components/tool-kit/UnitConverter';
import { QUANTITIES } from './logic';

export default function TypographyUnits() {
  return <UnitConverter quantity={QUANTITIES.typography} note="CSS uses 96 px per inch. em and rem assume a 16 px font size; if your root size differs, scale accordingly." />;
}
