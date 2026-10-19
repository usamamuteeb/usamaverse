'use client';

import { TransformTool } from '@/components/tool-kit/TransformTool';
import { str, type OptionDef } from '@/components/tool-kit/options';
import { convertCase, type CaseMode } from './logic';

const options: OptionDef[] = [
  {
    type: 'select',
    key: 'mode',
    label: 'Convert to',
    default: 'title',
    choices: [
      { value: 'upper', label: 'UPPER CASE' },
      { value: 'lower', label: 'lower case' },
      { value: 'title', label: 'Title Case' },
      { value: 'sentence', label: 'Sentence case' },
      { value: 'camel', label: 'camelCase' },
      { value: 'pascal', label: 'PascalCase' },
      { value: 'snake', label: 'snake_case' },
      { value: 'kebab', label: 'kebab-case' },
      { value: 'constant', label: 'CONSTANT_CASE' },
    ],
    hint: 'camel, Pascal, snake, kebab and constant convert each line separately.',
  },
];

export default function CaseConverter() {
  return <TransformTool options={options} example={'the quick BROWN fox. it jumped!\nuserAccountID'} transform={(t, v) => ({ output: convertCase(t, str(v.mode) as CaseMode) })} filename="converted.txt" />;
}
