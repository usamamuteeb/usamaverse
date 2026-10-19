'use client';

import { FormTool, type FieldDef, type FormResult, type FormValues } from '@/components/tool-kit/FormTool';
import { buildUtm } from './logic';

const fields: FieldDef[] = [
  { type: 'url', key: 'url', label: 'Destination URL', default: '', placeholder: 'https://example.com/landing' },
  { type: 'text', key: 'source', label: 'Source (utm_source) *', default: '', placeholder: 'newsletter, google, facebook' },
  { type: 'text', key: 'medium', label: 'Medium (utm_medium) *', default: '', placeholder: 'email, cpc, social' },
  { type: 'text', key: 'campaign', label: 'Campaign (utm_campaign) *', default: '', placeholder: 'winter_sale' },
  { type: 'text', key: 'term', label: 'Term (utm_term)', default: '', placeholder: 'paid keyword' },
  { type: 'text', key: 'content', label: 'Content (utm_content)', default: '', placeholder: 'banner_a' },
  { type: 'text', key: 'id', label: 'Campaign ID (utm_id)', default: '' },
];

function compute(v: FormValues): FormResult | null {
  if (!String(v.url).trim()) return null;
  const s = (k: string) => String(v[k] ?? '');
  return { output: buildUtm(s('url'), { source: s('source'), medium: s('medium'), campaign: s('campaign'), term: s('term'), content: s('content'), id: s('id') }), outputLabel: 'Tagged URL' };
}

export default function UtmBuilder() {
  return <FormTool fields={fields} compute={compute} />;
}
