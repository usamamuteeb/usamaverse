'use client';

import { UnitConverter } from '@/components/tool-kit/UnitConverter';
import { QUANTITIES } from './logic';

export default function DurationConverter() {
  return <UnitConverter quantity={QUANTITIES.duration} note="Months and years are Gregorian averages. Real calendar months have 28–31 days." />;
}
