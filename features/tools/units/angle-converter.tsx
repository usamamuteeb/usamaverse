'use client';

import { UnitConverter } from '@/components/tool-kit/UnitConverter';
import { QUANTITIES } from './logic';

export default function AngleConverter() {
  return <UnitConverter quantity={QUANTITIES.angle} />;
}
