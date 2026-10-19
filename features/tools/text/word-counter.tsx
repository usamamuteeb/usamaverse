'use client';

import { StatsTool, type Stat } from '@/components/tool-kit/StatsTool';
import { formatMinutes, readingTime, textStats } from './logic';

const n = (x: number) => x.toLocaleString('en-US');

function compute(input: string): Stat[] {
  const s = textStats(input);
  return [
    { label: 'Words', value: n(s.words) },
    { label: 'Characters', value: n(s.characters) },
    { label: 'Characters (no spaces)', value: n(s.charactersNoSpaces) },
    { label: 'Sentences', value: n(s.sentences) },
    { label: 'Paragraphs', value: n(s.paragraphs) },
    { label: 'Lines', value: n(s.lines) },
    { label: 'UTF-8 bytes', value: n(s.bytes) },
    { label: 'Reading time', value: formatMinutes(readingTime(input).readSeconds) },
  ];
}

export default function WordCounter() {
  return <StatsTool compute={compute} example={'The quick brown fox jumps over the lazy dog. 🦊\n\nEmoji like 👍🏽 and accents like café count as one character each.'} />;
}
