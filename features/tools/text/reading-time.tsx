'use client';

import { StatsTool, type Stat } from '@/components/tool-kit/StatsTool';
import { str, type OptionDef, type OptionValues } from '@/components/tool-kit/options';
import { formatMinutes, readingTime } from './logic';

const options: OptionDef[] = [
  { type: 'number', key: 'wpm', label: 'Reading speed', default: '238', suffix: 'words/min', hint: 'About 238 is a common average for silent reading of non-fiction.' },
  { type: 'number', key: 'speak', label: 'Speaking speed', default: '130', suffix: 'words/min' },
];

function compute(input: string, v: OptionValues): Stat[] {
  const wpm = Number(str(v.wpm));
  const speak = Number(str(v.speak));
  const r = readingTime(input, wpm, speak);
  return [
    { label: 'Words', value: r.words.toLocaleString('en-US') },
    { label: 'Reading time', value: formatMinutes(r.readSeconds) },
    { label: 'Speaking time', value: formatMinutes(r.speakSeconds) },
  ];
}

export default function ReadingTime() {
  return <StatsTool options={options} compute={compute} placeholder="Paste an article, script or speech…" />;
}
