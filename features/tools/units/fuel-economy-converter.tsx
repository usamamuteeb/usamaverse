'use client';

import { UnitConverter } from '@/components/tool-kit/UnitConverter';
import { QUANTITIES } from './logic';

export default function FuelEconomyConverter() {
  return <UnitConverter quantity={QUANTITIES.fuel} note="L/100 km is an inverse unit: lower is more efficient. US and imperial gallons differ by about 20%." />;
}
