'use client';

import { TransformTool } from '@/components/tool-kit/TransformTool';
import { bool, str, type OptionDef } from '@/components/tool-kit/options';
import { htmlDecode, htmlEncode } from './logic';

const options: OptionDef[] = [
  { type: 'select', key: 'mode', label: 'Mode', default: 'encode', choices: [{ value: 'encode', label: 'Encode (escape)' }, { value: 'decode', label: 'Decode (unescape)' }] },
  { type: 'checkbox', key: 'nonAscii', label: 'Also encode non-ASCII characters as numeric entities', default: false },
];

export default function HtmlEntities() {
  return <TransformTool options={options} example={'<p class="note">Tom & Jerry’s “café”</p>'} transform={(t, v) => ({ output: str(v.mode) === 'encode' ? htmlEncode(t, { nonAscii: bool(v.nonAscii) }) : htmlDecode(t) })} />;
}
