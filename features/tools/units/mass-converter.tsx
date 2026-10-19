'use client';

import { UnitConverter } from '@/components/tool-kit/UnitConverter';
import { QUANTITIES } from './logic';

export default function MassConverter() {
  return <UnitConverter quantity={QUANTITIES.mass} note="Mass units only. Newtons and pound-force measure force, not mass." />;
}
