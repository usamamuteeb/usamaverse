export const QWERTY_ROWS = ['qwertyuiop', 'asdfghjkl', 'zxcvbnm'] as const;

/** Characters produced by the same physical US letter keys. Punctuation keys are outside this preview. */
export const LAYOUTS = {
  qwerty: { name: 'US QWERTY', rows: ['qwertyuiop', 'asdfghjkl', 'zxcvbnm'] },
  qwertz: { name: 'German QWERTZ', rows: ['qwertzuiop', 'asdfghjkl', 'yxcvbnm'] },
  azerty: { name: 'French AZERTY', rows: ['azertyuiop', 'qsdfghjkl', 'wxcvbn,'] },
  dvorak: { name: 'US Dvorak', rows: ["',.pyfgcrl", 'aoeuidhtn', ';qjkxbm'] },
  colemak: { name: 'Colemak', rows: ['qwfpgjluy;', 'arstdhnei', 'zxcvbkm'] },
} as const;

export type LayoutName = keyof typeof LAYOUTS;

export function remapPhysicalLetters(input: string, from: LayoutName, to: LayoutName): string {
  const source = LAYOUTS[from].rows.join('');
  const target = LAYOUTS[to].rows.join('');
  const mapped = new Map<string, string>();
  for (let i = 0; i < source.length; i++) mapped.set(source[i], target[i]);
  return Array.from(input, (char) => {
    const out = mapped.get(char.toLowerCase());
    return out ? (char === char.toUpperCase() ? out.toUpperCase() : out) : char;
  }).join('');
}
