'use client';

import { UnitConverter } from '@/components/tool-kit/UnitConverter';
import { QUANTITIES } from './logic';

export default function DataSizeConverter() {
  return <UnitConverter quantity={QUANTITIES.data} note="Decimal units (kB, MB, GB) use powers of 1000; binary units (KiB, MiB, GiB) use powers of 1024." />;
}
