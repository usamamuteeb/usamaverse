'use client';

import { UnitConverter } from '@/components/tool-kit/UnitConverter';
import { QUANTITIES } from './logic';

export default function AreaConverter() {
  return <UnitConverter quantity={QUANTITIES.area} />;
}
