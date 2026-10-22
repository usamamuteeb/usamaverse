'use client';

import { wordlist } from '@scure/bip39/wordlists/english.js';
import { GeneratorTool } from '@/components/tool-kit/GeneratorTool';
import { str, type OptionDef } from '@/components/tool-kit/options';
import { randomIndex } from '@/lib/tools/shared/random';

const options: OptionDef[] = [
  { type: 'number', key: 'words', label: 'Words (4–12)', default: '6' },
  { type: 'number', key: 'count', label: 'How many (1–20)', default: '1' },
  { type: 'select', key: 'separator', label: 'Separator', default: '-', choices: [{ value: '-', label: 'Hyphen (-)' }, { value: ' ', label: 'Space' }, { value: '_', label: 'Underscore (_)' }, { value: '.', label: 'Dot (.)' }] },
];

export default function PassphraseGenerator() {
  return <GeneratorTool options={options} outputLabel="Passphrases" filename="passphrases.txt" generate={(v) => {
    const words = Number(str(v.words));
    const count = Number(str(v.count));
    if (!Number.isInteger(words) || words < 4 || words > 12) throw new Error('Choose 4–12 words.');
    if (!Number.isInteger(count) || count < 1 || count > 20) throw new Error('Generate 1–20 passphrases.');
    return Array.from({ length: count }, () => Array.from({ length: words }, () => wordlist[randomIndex(wordlist.length)]).join(str(v.separator))).join('\n');
  }} describe={(v) => {
    const words = Number(str(v.words));
    return <p className="summary">{Number.isInteger(words) && words >= 4 && words <= 12 ? `${words * Math.log2(wordlist.length)} bits of estimated entropy` : 'Choose 4–12 words'} · {wordlist.length.toLocaleString()} equally likely English words · generated locally with Web Crypto. These are independent words, not a BIP39 recovery phrase.</p>;
  }} />;
}
