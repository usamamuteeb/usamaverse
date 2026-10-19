import type { Anchor, FontChoice } from './ops';

export const ANCHORS: Array<{ value: Anchor; label: string }> = [
  { value: 'bottom-center', label: 'Bottom centre' },
  { value: 'bottom-right', label: 'Bottom right' },
  { value: 'bottom-left', label: 'Bottom left' },
  { value: 'top-center', label: 'Top centre' },
  { value: 'top-right', label: 'Top right' },
  { value: 'top-left', label: 'Top left' },
];

export const FONTS: Array<{ value: FontChoice; label: string }> = [
  { value: 'Helvetica', label: 'Helvetica' },
  { value: 'HelveticaBold', label: 'Helvetica Bold' },
  { value: 'TimesRoman', label: 'Times' },
  { value: 'Courier', label: 'Courier' },
];
