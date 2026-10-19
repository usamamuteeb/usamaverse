'use client';

import { TransformTool } from '@/components/tool-kit/TransformTool';
import { bool, str, type OptionDef } from '@/components/tool-kit/options';
import { formatSql } from './formatters';

const options: OptionDef[] = [
  { type: 'checkbox', key: 'upper', label: 'Uppercase keywords', default: true },
  { type: 'select', key: 'indent', label: 'Indent', default: '2', choices: [{ value: '2', label: '2 spaces' }, { value: '4', label: '4 spaces' }, { value: 'tab', label: 'Tab' }] },
];

export default function SqlFormatter() {
  return (
    <TransformTool
      inputLabel="SQL"
      options={options}
      example={"select u.id, u.name, count(o.id) as orders from users u left join orders o on o.user_id = u.id and o.status = 'paid' where u.created_at > '2026-01-01' group by u.id, u.name having count(o.id) > 2 order by orders desc limit 10;"}
      transform={(t, v) => ({ output: formatSql(t, { uppercase: bool(v.upper), indent: str(v.indent) === 'tab' ? '\t' : ' '.repeat(Number(str(v.indent))) }) })}
      filename="query.sql"
    />
  );
}
