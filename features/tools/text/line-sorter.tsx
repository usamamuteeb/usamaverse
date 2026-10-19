'use client';

import { TransformTool } from '@/components/tool-kit/TransformTool';
import { bool, str, type OptionDef } from '@/components/tool-kit/options';
import { sortLines, type SortMode } from './logic';

const options: OptionDef[] = [
  {
    type: 'select',
    key: 'mode',
    label: 'Order',
    default: 'az',
    choices: [
      { value: 'az', label: 'A → Z' },
      { value: 'za', label: 'Z → A' },
      { value: 'natural', label: 'Natural (file2 before file10)' },
      { value: 'length', label: 'Shortest first' },
      { value: 'length-desc', label: 'Longest first' },
      { value: 'reverse', label: 'Reverse current order' },
      { value: 'shuffle', label: 'Shuffle (random)' },
    ],
  },
  { type: 'checkbox', key: 'caseSensitive', label: 'Case-sensitive', default: false },
  { type: 'checkbox', key: 'removeEmpty', label: 'Remove empty lines', default: true },
];

export default function LineSorter() {
  return (
    <TransformTool
      options={options}
      example={'file10.txt\nbanana\nfile2.txt\nApple\ncherry'}
      transform={(t, v) => ({ output: sortLines(t, { mode: str(v.mode) as SortMode, caseSensitive: bool(v.caseSensitive), removeEmpty: bool(v.removeEmpty) }) })}
      filename="sorted.txt"
    />
  );
}
