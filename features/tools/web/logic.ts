export function parseUrlParts(input: string) {
  const t = input.trim();
  if (!t) throw new Error('Paste a URL.');
  let url: URL;
  try {
    url = new URL(t);
  } catch {
    throw new Error(/^[\w-]+(\.[\w-]+)+/.test(t) ? 'Add a scheme such as https:// at the start so the URL can be parsed.' : 'This is not a valid absolute URL.');
  }
  const defaultPorts: Record<string, string> = { 'http:': '80', 'https:': '443', 'ftp:': '21', 'ws:': '80', 'wss:': '443' };
  const params = [...url.searchParams.entries()].map(([key, value], i) => ({ index: i + 1, key, value }));
  let decodedPath = url.pathname;
  try {
    decodedPath = decodeURIComponent(url.pathname);
  } catch {
    /* keep encoded */
  }
  return {
    href: url.href,
    protocol: url.protocol,
    username: url.username,
    hasPassword: url.password !== '',
    hostname: url.hostname,
    port: url.port || (defaultPorts[url.protocol] ? `${defaultPorts[url.protocol]} (default)` : ''),
    origin: url.origin,
    pathname: url.pathname,
    decodedPath,
    search: url.search,
    hash: url.hash,
    params,
  };
}

export function buildUtm(base: string, fields: Record<'source' | 'medium' | 'campaign' | 'term' | 'content' | 'id', string>): string {
  let url: URL;
  try {
    url = new URL(base.trim());
  } catch {
    throw new Error('Enter the full destination URL, including https://');
  }
  if (!/^https?:$/.test(url.protocol)) throw new Error('The destination must be an http or https URL.');
  if (!fields.source.trim()) throw new Error('utm_source is required (for example newsletter, google).');
  if (!fields.medium.trim()) throw new Error('utm_medium is required (for example email, cpc, social).');
  if (!fields.campaign.trim()) throw new Error('utm_campaign is required (for example spring_sale).');
  for (const [k, v] of Object.entries(fields)) {
    const key = `utm_${k}`;
    if (v.trim()) url.searchParams.set(key, v.trim());
    else url.searchParams.delete(key);
  }
  return url.href;
}

const URL_RE = /\b(?:https?:\/\/|www\.)[^\s<>"'`{}|\\^]+/gi;

function trimTrailing(u: string): string {
  let s = u;
  // Strip trailing punctuation, and closing brackets that are unbalanced within the URL.
  for (;;) {
    const last = s[s.length - 1];
    if (/[.,;:!?'"]/.test(last)) s = s.slice(0, -1);
    else if (last === ')' && (s.match(/\(/g)?.length ?? 0) < (s.match(/\)/g)?.length ?? 0)) s = s.slice(0, -1);
    else if (last === ']' && (s.match(/\[/g)?.length ?? 0) < (s.match(/\]/g)?.length ?? 0)) s = s.slice(0, -1);
    else break;
  }
  return s;
}

export function extractUrls(text: string, o: { unique: boolean; mode: 'urls' | 'domains' }): string[] {
  const found: string[] = [];
  for (const m of text.matchAll(URL_RE)) {
    const raw = trimTrailing(m[0]);
    const withScheme = raw.toLowerCase().startsWith('www.') ? `https://${raw}` : raw;
    let parsed: URL;
    try {
      parsed = new URL(withScheme);
    } catch {
      continue;
    }
    if (!parsed.hostname.includes('.') && parsed.hostname !== 'localhost') continue;
    found.push(o.mode === 'domains' ? parsed.hostname.replace(/^www\./, '') : raw);
  }
  return o.unique ? [...new Set(found)] : found;
}
