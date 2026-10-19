'use client';

import { useMemo } from 'react';
import { SelectField } from '@/components/tool-kit/fields';
import { allZones } from './zones';

export function ZoneSelect({ label, value, onChange, hint }: { label: string; value: string; onChange: (v: string) => void; hint?: string }) {
  const options = useMemo(() => allZones().map((z) => ({ value: z, label: z.replace(/_/g, ' ') })), []);
  return <SelectField label={label} value={value} onChange={onChange} options={options} hint={hint} />;
}
