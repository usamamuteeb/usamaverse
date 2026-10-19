'use client';

import { TransformTool } from '@/components/tool-kit/TransformTool';
import { str, type OptionDef } from '@/components/tool-kit/options';
import { urlDecode, urlEncode, type UrlMode } from './logic';

const options: OptionDef[] = [
  { type: 'select', key: 'dir', label: 'Mode', default: 'encode', choices: [{ value: 'encode', label: 'Encode' }, { value: 'decode', label: 'Decode' }] },
  {
    type: 'select',
    key: 'mode',
    label: 'Encoding style',
    default: 'component',
    choices: [
      { value: 'component', label: 'Component — for one query value or path segment' },
      { value: 'uri', label: 'Full URL — keeps : / ? & = #' },
      { value: 'form', label: 'Form data — spaces as +' },
    ],
  },
];

export default function UrlEncoder() {
  return <TransformTool options={options} example="name=Usama Khan & city=Lahore/PK ✓" transform={(t, v) => ({ output: str(v.dir) === 'encode' ? urlEncode(t, str(v.mode) as UrlMode) : urlDecode(t, str(v.mode) as UrlMode) })} />;
}
