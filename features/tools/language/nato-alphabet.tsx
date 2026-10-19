'use client';

import { TransformTool } from '@/components/tool-kit/TransformTool';
import { str, type OptionDef } from '@/components/tool-kit/options';
import { fromNato, toNato } from './logic';

const options: OptionDef[] = [{ type: 'select', key: 'dir', label: 'Mode', default: 'encode', choices: [{ value: 'encode', label: 'Spell out text' }, { value: 'decode', label: 'NATO words → text' }] }];

export default function NatoAlphabet() {
  return <TransformTool options={options} example="Order 4B7Z" allowFile={false} transform={(t, v) => ({ output: str(v.dir) === 'encode' ? toNato(t) : fromNato(t) })} />;
}
