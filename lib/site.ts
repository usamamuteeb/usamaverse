/**
 * Brand settings. "UsamaVerse" is a working placeholder name, not an approved
 * brand or domain. Change it here and it updates everywhere.
 */
export const siteConfig = {
  name: 'UsamaVerse',
  shortName: 'UV',
  tagline: 'Practical tools that run in your browser.',
  description:
    'A free, anonymous toolbox for text, data, images, units, dates, colors and more. No sign-in. Most tools process everything locally in your browser.',
  url: (process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000').replace(/\/$/, ''),
  /** Optional. Leave empty until a real feedback address exists. */
  feedbackEmail: '',
} as const;
