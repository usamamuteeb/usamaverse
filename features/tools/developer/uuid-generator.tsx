'use client';

import { GeneratorTool } from '@/components/tool-kit/GeneratorTool';
import { bool, str, type OptionDef } from '@/components/tool-kit/options';
import { uuids } from '@/features/tools/generators/logic';

const options: OptionDef[] = [
  { type: 'number', key: 'count', label: 'How many (1–500)', default: '5' },
  { type: 'checkbox', key: 'upper', label: 'Uppercase', default: false },
  { type: 'checkbox', key: 'hyphens', label: 'Include hyphens', default: true },
];

export default function UuidGenerator() {
  return <GeneratorTool options={options} outputLabel="UUIDs (v4)" filename="uuids.txt" generate={(v) => uuids(Number(str(v.count)), bool(v.upper), bool(v.hyphens)).join('\n')} />;
}
