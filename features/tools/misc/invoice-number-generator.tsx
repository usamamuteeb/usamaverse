'use client';

import { GeneratorTool } from '@/components/tool-kit/GeneratorTool';
import { str, type OptionDef } from '@/components/tool-kit/options';
import { invoiceNumbers } from '@/features/tools/language/logic';

const options: OptionDef[] = [
  { type: 'text', key: 'pattern', label: 'Pattern', default: 'INV-{YYYY}{MM}-{SEQ:4}', hint: 'Placeholders: {YYYY} {YY} {MM} {DD} (today), {SEQ} or {SEQ:4} (running number padded to 4 digits).' },
  { type: 'number', key: 'start', label: 'Start at', default: '1' },
  { type: 'number', key: 'count', label: 'How many', default: '10' },
  { type: 'number', key: 'step', label: 'Step', default: '1' },
];

export default function InvoiceNumberGenerator() {
  return (
    <GeneratorTool
      options={options}
      outputLabel="Numbers"
      filename="invoice-numbers.txt"
      generate={(v) => invoiceNumbers(str(v.pattern), Number(str(v.start)), Number(str(v.count)), Number(str(v.step)), new Date()).join('\n')}
      note={<p className="field-hint">Nothing is stored, so this tool can’t remember your last number. Check your own records and local rules for invoice numbering.</p>}
    />
  );
}
