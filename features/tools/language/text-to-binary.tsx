'use client';

import { TransformTool } from '@/components/tool-kit/TransformTool';
import { str, type OptionDef } from '@/components/tool-kit/options';
import { bytesToText, textToBytes, type ByteFormat } from './logic';

const options: OptionDef[] = [
  { type: 'select', key: 'dir', label: 'Mode', default: 'encode', choices: [{ value: 'encode', label: 'Text → bytes' }, { value: 'decode', label: 'Bytes → text' }] },
  { type: 'select', key: 'fmt', label: 'Byte format', default: 'binary', choices: [{ value: 'binary', label: 'Binary (01001000)' }, { value: 'hex', label: 'Hexadecimal (48)' }, { value: 'decimal', label: 'Decimal (72)' }, { value: 'octal', label: 'Octal (110)' }] },
];

export default function TextToBinary() {
  return <TransformTool options={options} example="Hi 👋" transform={(t, v) => ({ output: str(v.dir) === 'encode' ? textToBytes(t, str(v.fmt) as ByteFormat) : bytesToText(t, str(v.fmt) as ByteFormat), summary: str(v.dir) === 'encode' ? `${new TextEncoder().encode(t).length} UTF-8 bytes.` : undefined })} />;
}
