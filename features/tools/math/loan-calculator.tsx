'use client';

import { DownloadTextButton } from '@/components/tool-kit/actions';
import { FormTool, type FieldDef, type FormResult, type FormValues } from '@/components/tool-kit/FormTool';
import { formatMoney } from '@/lib/format';
import { parseNum } from './logic';
import { amortization } from './more';

const fields: FieldDef[] = [
  { type: 'number', key: 'amount', label: 'Loan amount', default: '', placeholder: '500000' },
  { type: 'number', key: 'rate', label: 'Annual interest rate', default: '', suffix: '%', placeholder: '12' },
  { type: 'number', key: 'term', label: 'Term', default: '5' },
  { type: 'select', key: 'unit', label: 'Term unit', default: 'years', choices: [{ value: 'years', label: 'Years' }, { value: 'months', label: 'Months' }] },
];

function compute(v: FormValues): FormResult | null {
  if (!String(v.amount).trim() || !String(v.rate).trim()) return null;
  const term = parseNum(v.term, 'the term', { min: 1 });
  const months = Math.round(v.unit === 'years' ? term * 12 : term);
  const a = amortization(parseNum(v.amount, 'the loan amount', { min: 0 }), parseNum(v.rate, 'the rate', { min: 0, max: 100 }), months);
  const csv = ['Month,Payment,Interest,Principal,Balance', ...a.rows.map((r) => [r.month, r.payment, r.interest, r.principal, r.balance].map((x, i) => (i ? x.toFixed(2) : x)).join(','))].join('\n');
  return {
    rows: [
      { label: 'Monthly payment', value: formatMoney(a.payment), emphasis: true },
      { label: 'Number of payments', value: String(months) },
      { label: 'Total interest', value: formatMoney(a.totalInterest) },
      { label: 'Total paid', value: formatMoney(a.payment * months) },
    ],
    note: 'Assumes a fixed rate, monthly payments and interest compounded monthly, with no fees, insurance or taxes. Your lender’s figures may differ.',
    extra: (
      <>
        <div className="table-scroll">
          <table className="data-table compact">
            <caption>Schedule (first 24 months)</caption>
            <thead>
              <tr>
                <th scope="col">Month</th>
                <th scope="col">Interest</th>
                <th scope="col">Principal</th>
                <th scope="col">Balance</th>
              </tr>
            </thead>
            <tbody>
              {a.rows.slice(0, 24).map((r) => (
                <tr key={r.month}>
                  <td>{r.month}</td>
                  <td>{formatMoney(r.interest)}</td>
                  <td>{formatMoney(r.principal)}</td>
                  <td>{formatMoney(r.balance)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="actions">
          <DownloadTextButton text={csv} filename="amortization.csv" mime="text/csv" label="Download full schedule (CSV)" />
        </div>
      </>
    ),
  };
}

export default function LoanCalculator() {
  return <FormTool fields={fields} compute={compute} />;
}
