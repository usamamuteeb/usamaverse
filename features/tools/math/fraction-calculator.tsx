'use client';

import { FormTool, type FieldDef, type FormResult, type FormValues } from '@/components/tool-kit/FormTool';
import { evaluateFraction, formatRational } from './more';

const fields: FieldDef[] = [{ type: 'text', key: 'expr', label: 'Expression', default: '1/2 + 2 1/3 × 3/4', hint: 'Fractions like 3/4, mixed numbers like 2 1/3, decimals, + − × ÷, ^ (whole exponents) and parentheses.' }];

function compute(v: FormValues): FormResult | null {
  if (!String(v.expr).trim()) return null;
  const r = formatRational(evaluateFraction(String(v.expr)));
  return {
    rows: [
      { label: 'Simplified fraction', value: r.fraction, emphasis: true },
      { label: 'Mixed number', value: r.mixed },
      { label: 'Decimal', value: r.decimal },
    ],
    note: 'Calculated exactly with whole-number arithmetic; a repeating decimal is shown in parentheses, e.g. 0.(3).',
  };
}

export default function FractionCalculator() {
  return <FormTool fields={fields} compute={compute} />;
}
