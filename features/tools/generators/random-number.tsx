'use client';

import { GeneratorTool } from '@/components/tool-kit/GeneratorTool';
import { bool, str, type OptionDef } from '@/components/tool-kit/options';
import { randomNumbers } from './logic';

const options: OptionDef[] = [
  { type: 'number', key: 'min', label: 'Minimum', default: '1' },
  { type: 'number', key: 'max', label: 'Maximum', default: '100' },
  { type: 'number', key: 'count', label: 'How many (1–1,000)', default: '1' },
  { type: 'checkbox', key: 'unique', label: 'No repeats', default: false },
  { type: 'checkbox', key: 'sort', label: 'Sort ascending', default: false },
  { type: 'select', key: 'sep', label: 'Separate with', default: 'newline', choices: [{ value: 'newline', label: 'New lines' }, { value: 'comma', label: 'Commas' }, { value: 'space', label: 'Spaces' }] },
];

export default function RandomNumber() {
  return (
    <GeneratorTool
      options={options}
      outputLabel="Numbers"
      generate={(v) => {
        const nums = randomNumbers({ min: Number(str(v.min)), max: Number(str(v.max)), count: Number(str(v.count)), unique: bool(v.unique), sort: bool(v.sort) });
        const sep = { newline: '\n', comma: ', ', space: ' ' }[str(v.sep) as 'newline'];
        return nums.join(sep);
      }}
    />
  );
}
