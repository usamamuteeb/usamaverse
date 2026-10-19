'use client';

import { FormTool, type FieldDef, type FormResult, type FormValues } from '@/components/tool-kit/FormTool';
import { formatMoney } from '@/lib/format';
import { parseNum } from './logic';
import { compoundGrowth } from './more';

const fields: FieldDef[] = [
  { type: 'select', key: 'kind', label: 'Interest type', default: 'compound', choices: [{ value: 'compound', label: 'Compound' }, { value: 'simple', label: 'Simple' }] },
  { type: 'number', key: 'principal', label: 'Starting amount', default: '100000' },
  { type: 'number', key: 'rate', label: 'Annual rate', default: '8', suffix: '%' },
  { type: 'number', key: 'years', label: 'Years', default: '10' },
  {
    type: 'select', key: 'freq', label: 'Compounding', default: '12', showIf: (v) => v.kind === 'compound',
    choices: [{ value: '1', label: 'Yearly' }, { value: '2', label: 'Half-yearly' }, { value: '4', label: 'Quarterly' }, { value: '12', label: 'Monthly' }, { value: '52', label: 'Weekly' }, { value: '365', label: 'Daily' }],
  },
  { type: 'number', key: 'monthly', label: 'Monthly contribution', default: '0', showIf: (v) => v.kind === 'compound', hint: 'Added at the end of each compounding period (spread evenly).' },
];

function compute(v: FormValues): FormResult {
  const r = compoundGrowth({
    principal: parseNum(v.principal, 'the starting amount', { min: 0 }),
    ratePct: parseNum(v.rate, 'the rate'),
    years: parseNum(v.years, 'the number of years', { min: 0 }),
    perYear: Number(v.freq),
    contribution: v.kind === 'compound' ? parseNum(v.monthly || '0', 'the monthly contribution', { min: 0 }) : 0,
    simple: v.kind === 'simple',
  });
  return {
    rows: [
      { label: 'Final balance', value: formatMoney(r.final), emphasis: true },
      { label: 'Total contributed', value: formatMoney(r.contributed) },
      { label: 'Interest earned', value: formatMoney(r.final - r.contributed) },
    ],
    note: 'Before tax, fees and inflation. Real returns are rarely constant.',
    extra: (
      <div className="table-scroll">
        <table className="data-table compact">
          <caption>Year by year</caption>
          <thead>
            <tr>
              <th scope="col">Year</th>
              <th scope="col">Balance</th>
              <th scope="col">Interest so far</th>
            </tr>
          </thead>
          <tbody>
            {r.yearly.slice(0, 60).map((y) => (
              <tr key={y.year}>
                <td>{y.year}</td>
                <td>{formatMoney(y.balance)}</td>
                <td>{formatMoney(y.interest)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    ),
  };
}

export default function InterestCalculator() {
  return <FormTool fields={fields} compute={compute} />;
}
