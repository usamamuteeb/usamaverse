'use client';

import { TransformTool } from '@/components/tool-kit/TransformTool';
import { str, type OptionDef } from '@/components/tool-kit/options';
import { parseYamlAll, stringifyYaml, type YamlValue } from './yaml';

const options: OptionDef[] = [
  {
    type: 'select',
    key: 'mode',
    label: 'Output',
    default: 'yaml',
    choices: [
      { value: 'yaml', label: 'Validate & tidy YAML' },
      { value: 'json', label: 'YAML → JSON' },
      { value: 'from-json', label: 'JSON → YAML' },
    ],
  },
  { type: 'select', key: 'indent', label: 'Indent', default: '2', choices: [{ value: '2', label: '2 spaces' }, { value: '4', label: '4 spaces' }] },
];

function describe(v: YamlValue): string {
  if (Array.isArray(v)) return `a list of ${v.length} item${v.length === 1 ? '' : 's'}`;
  if (v && typeof v === 'object') {
    const n = Object.keys(v).length;
    return `a map with ${n} key${n === 1 ? '' : 's'}`;
  }
  return v === null ? 'null' : `a single ${typeof v}`;
}

export default function YamlValidator() {
  return (
    <TransformTool
      inputLabel="YAML (or JSON for JSON → YAML)"
      options={options}
      example={'# Service config\nname: usamaverse\nversion: 1.2\nfeatures: [pdf, cv, latex]\ndefaults: &defaults\n  region: ap-south-1\n  retries: 3\nproduction:\n  <<: *defaults\n  debug: false\ndescription: >\n  Folded text is joined\n  into one line.\n'}
      transform={(t, v) => {
        const indent = Number(str(v.indent)) || 2;
        const mode = str(v.mode);
        if (mode === 'from-json') {
          let data: unknown;
          try {
            data = JSON.parse(t);
          } catch (e) {
            throw new Error(`Not valid JSON: ${(e as Error).message}`);
          }
          return { output: stringifyYaml(data, indent), summary: 'Converted JSON to YAML.' };
        }
        const docs = parseYamlAll(t);
        const summary = `Valid YAML — ${docs.length === 1 ? describe(docs[0]) : `${docs.length} documents`}.`;
        if (mode === 'json') return { output: JSON.stringify(docs.length === 1 ? docs[0] : docs, null, indent) + '\n', summary };
        return { output: docs.map((d) => stringifyYaml(d, indent)).join('---\n'), summary, warning: /(^|\n)\s*#/.test(t) ? 'Comments are not kept in the tidied output.' : undefined };
      }}
      filename="data.yaml"
      mime="application/yaml"
    />
  );
}
