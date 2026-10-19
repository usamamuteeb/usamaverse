'use client';

import { UnitConverter } from '@/components/tool-kit/UnitConverter';
import { QUANTITIES } from './logic';

export default function LengthConverter() {
  return <UnitConverter quantity={QUANTITIES.length} />;
}
