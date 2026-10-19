'use client';

import { UnitConverter } from '@/components/tool-kit/UnitConverter';
import { QUANTITIES } from './logic';

export default function EnergyConverter() {
  return <UnitConverter quantity={QUANTITIES.energy} note="Food “Calories” on labels are kilocalories (kcal)." />;
}
