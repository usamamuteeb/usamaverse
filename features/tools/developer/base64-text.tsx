'use client';

import { TransformTool } from '@/components/tool-kit/TransformTool';
import { bool, str, type OptionDef } from '@/components/tool-kit/options';
import { base64DecodeText, base64EncodeText } from './logic';

const options: OptionDef[] = [
  { type: 'select', key: 'dir', label: 'Mode', default: 'encode', choices: [{ value: 'encode', label: 'Encode text → Base64' }, { value: 'decode', label: 'Decode Base64 → text' }] },
  { type: 'checkbox', key: 'urlSafe', label: 'URL-safe alphabet (- and _, no padding) when encoding', default: false },
];

export default function Base64Text() {
  return <TransformTool options={options} example="Hello, world! 👋 Salaam" transform={(t, v) => ({ output: str(v.dir) === 'encode' ? base64EncodeText(t, bool(v.urlSafe)) : base64DecodeText(t) })} />;
}
