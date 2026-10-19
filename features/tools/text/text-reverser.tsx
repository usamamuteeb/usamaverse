'use client';

import { TransformTool } from '@/components/tool-kit/TransformTool';
import { str, type OptionDef } from '@/components/tool-kit/options';
import { reverseText, type ReverseMode } from './logic';

const options: OptionDef[] = [
  {
    type: 'select',
    key: 'mode',
    label: 'Reverse',
    default: 'characters',
    choices: [
      { value: 'characters', label: 'Characters' },
      { value: 'words', label: 'Word order (each line)' },
      { value: 'lines', label: 'Line order' },
    ],
  },
];

export default function TextReverser() {
  return <TransformTool options={options} example={'Hello 👋🏽 café 👨‍👩‍👧\nsecond line'} transform={(t, v) => ({ output: reverseText(t, str(v.mode) as ReverseMode) })} />;
}
