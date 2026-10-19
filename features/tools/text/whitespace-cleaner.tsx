'use client';

import { TransformTool } from '@/components/tool-kit/TransformTool';
import { bool, type OptionDef } from '@/components/tool-kit/options';
import { cleanWhitespace } from './logic';

const options: OptionDef[] = [
  { type: 'checkbox', key: 'trimLines', label: 'Trim spaces at the start and end of each line', default: true },
  { type: 'checkbox', key: 'collapseSpaces', label: 'Collapse repeated spaces into one', default: true },
  { type: 'checkbox', key: 'tabsToSpaces', label: 'Convert tabs to spaces', default: false },
  { type: 'checkbox', key: 'removeInvisible', label: 'Remove zero-width characters and normalise non-breaking spaces', default: true },
  { type: 'checkbox', key: 'trimDocument', label: 'Remove leading and trailing blank space from the whole text', default: true },
];

export default function WhitespaceCleaner() {
  return (
    <TransformTool
      options={options}
      example={'   Too    many   spaces   \n\tTabbed​ line   \n  end  '}
      transform={(t, v) => ({
        output: cleanWhitespace(t, {
          trimLines: bool(v.trimLines),
          collapseSpaces: bool(v.collapseSpaces),
          tabsToSpaces: bool(v.tabsToSpaces),
          removeInvisible: bool(v.removeInvisible),
          trimDocument: bool(v.trimDocument),
        }),
      })}
      filename="cleaned.txt"
    />
  );
}
