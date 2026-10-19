'use client';

import { UnitConverter } from '@/components/tool-kit/UnitConverter';
import { QUANTITIES } from './logic';

export default function PowerConverter() {
  return <UnitConverter quantity={QUANTITIES.power} />;
}
