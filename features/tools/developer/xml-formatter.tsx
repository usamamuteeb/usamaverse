'use client';

import { TransformTool } from '@/components/tool-kit/TransformTool';
import { str, type OptionDef } from '@/components/tool-kit/options';
import { formatXml } from './xml';

const options: OptionDef[] = [
  { type: 'select', key: 'indent', label: 'Output', default: '2', choices: [{ value: '2', label: 'Pretty — 2 spaces' }, { value: '4', label: 'Pretty — 4 spaces' }, { value: 'tab', label: 'Pretty — tabs' }, { value: 'minify', label: 'Minified (drops comments)' }] },
];

export default function XmlFormatter() {
  return (
    <TransformTool
      inputLabel="XML"
      options={options}
      example={'<?xml version="1.0"?><catalog><book id="b1"><title>Example</title><price currency="PKR">1200</price></book><!-- more --><book id="b2"/></catalog>'}
      transform={(t, v) => ({ output: formatXml(t, { indent: str(v.indent) as '2' }), summary: 'Well-formed XML.' })}
      filename="formatted.xml"
      mime="application/xml"
    />
  );
}
