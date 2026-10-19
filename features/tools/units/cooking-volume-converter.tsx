'use client';

import { UnitConverter } from '@/components/tool-kit/UnitConverter';
import { QUANTITIES } from './logic';

export default function CookingVolumeConverter() {
  return <UnitConverter quantity={QUANTITIES.cooking} note="Cup and spoon sizes differ by country. Check which one your recipe uses; for baking, weighing ingredients is more reliable." />;
}
