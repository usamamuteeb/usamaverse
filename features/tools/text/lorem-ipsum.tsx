'use client';

import { GeneratorTool } from '@/components/tool-kit/GeneratorTool';
import { bool, str, type OptionDef } from '@/components/tool-kit/options';
import { lorem } from './logic';

const options: OptionDef[] = [
  { type: 'select', key: 'kind', label: 'Generate', default: 'paragraphs', choices: [{ value: 'paragraphs', label: 'Paragraphs' }, { value: 'sentences', label: 'Sentences' }, { value: 'words', label: 'Words' }] },
  { type: 'number', key: 'count', label: 'How many (1–500)', default: '3' },
  { type: 'checkbox', key: 'start', label: 'Start with “Lorem ipsum dolor sit amet…”', default: true },
];

export default function LoremIpsum() {
  return <GeneratorTool options={options} outputLabel="Placeholder text" filename="lorem-ipsum.txt" generate={(v) => lorem(str(v.kind) as 'paragraphs', Number(str(v.count)), bool(v.start))} />;
}
