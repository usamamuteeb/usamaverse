'use client';

import { UnitConverter } from '@/components/tool-kit/UnitConverter';
import { QUANTITIES } from './logic';

export default function TemperatureConverter() {
  return <UnitConverter quantity={QUANTITIES.temperature} note="Converts readings (for example 20 °C → 68 °F), not temperature differences." />;
}
