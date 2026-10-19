'use client';

import { UnitConverter } from '@/components/tool-kit/UnitConverter';
import { QUANTITIES } from './logic';

export default function ForceConverter() {
  return <UnitConverter quantity={QUANTITIES.force} note="Force, not mass: 1 kgf is the weight of 1 kg under standard gravity (9.80665 m/s²)." />;
}
