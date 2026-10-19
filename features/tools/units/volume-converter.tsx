'use client';

import { UnitConverter } from '@/components/tool-kit/UnitConverter';
import { QUANTITIES } from './logic';

export default function VolumeConverter() {
  return <UnitConverter quantity={QUANTITIES.volume} />;
}
