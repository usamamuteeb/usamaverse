'use client';

import { FormTool, type FieldDef, type FormResult, type FormValues } from '@/components/tool-kit/FormTool';
import { metaTags } from './more';

const fields: FieldDef[] = [
  { type: 'text', key: 'title', label: 'Page title', default: '' },
  { type: 'textarea', key: 'description', label: 'Description', default: '' },
  { type: 'url', key: 'url', label: 'Canonical page URL', default: '', placeholder: 'https://example.com/page' },
  { type: 'url', key: 'image', label: 'Share image URL (1200 × 630 recommended)', default: '' },
  { type: 'text', key: 'imageAlt', label: 'Image alt text', default: '' },
  { type: 'text', key: 'siteName', label: 'Site name', default: '' },
  { type: 'select', key: 'type', label: 'Open Graph type', default: 'website', choices: [{ value: 'website', label: 'website' }, { value: 'article', label: 'article' }, { value: 'product', label: 'product' }, { value: 'profile', label: 'profile' }] },
  { type: 'select', key: 'twitterCard', label: 'Twitter/X card', default: '', choices: [{ value: '', label: 'Automatic' }, { value: 'summary', label: 'summary' }, { value: 'summary_large_image', label: 'summary_large_image' }] },
  { type: 'text', key: 'twitterSite', label: 'Twitter/X @handle (optional)', default: '' },
  { type: 'text', key: 'locale', label: 'Locale (optional)', default: '', placeholder: 'en_US' },
];

function compute(v: FormValues): FormResult | null {
  if (!String(v.title).trim()) return null;
  const s = (k: string) => String(v[k] ?? '');
  const r = metaTags({ title: s('title'), description: s('description'), url: s('url'), image: s('image'), imageAlt: s('imageAlt'), siteName: s('siteName'), type: s('type'), twitterCard: s('twitterCard'), twitterSite: s('twitterSite'), locale: s('locale') });
  return {
    output: r.html,
    outputLabel: 'Paste into <head> (values are escaped)',
    rows: [{ label: 'Title length', value: `${s('title').length} characters` }, { label: 'Description length', value: `${s('description').length} characters` }],
    note: r.warnings.length ? r.warnings.join(' ') : undefined,
  };
}

export default function MetaTagGenerator() {
  return <FormTool fields={fields} compute={compute} />;
}
