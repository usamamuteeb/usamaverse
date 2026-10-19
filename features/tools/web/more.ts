// ---------------------------------------------------------------- Query strings

export function buildQuery(base: string, rows: Array<{ key: string; value: string }>, keepExisting: boolean): string {
  const b = base.trim();
  let url: URL | null = null;
  if (b) {
    try {
      url = new URL(b);
    } catch {
      throw new Error('The base must be a full URL (https://…), or leave it empty to build only a query string.');
    }
  }
  const params = new URLSearchParams(keepExisting && url ? url.search : '');
  rows.filter((r) => r.key.trim()).forEach((r) => params.append(r.key.trim(), r.value));
  const qs = params.toString();
  if (!url) return qs ? `?${qs}` : '';
  url.search = qs;
  return url.href;
}

// ---------------------------------------------------------------- MIME types

export const MIME_TYPES: Array<[string, string, string]> = [
  ['html', 'text/html', 'HTML document'], ['htm', 'text/html', 'HTML document'], ['css', 'text/css', 'Stylesheet'],
  ['js', 'text/javascript', 'JavaScript'], ['mjs', 'text/javascript', 'JavaScript module'], ['json', 'application/json', 'JSON'],
  ['jsonld', 'application/ld+json', 'JSON-LD'], ['map', 'application/json', 'Source map'], ['xml', 'application/xml', 'XML'],
  ['txt', 'text/plain', 'Plain text'], ['csv', 'text/csv', 'CSV'], ['tsv', 'text/tab-separated-values', 'TSV'],
  ['md', 'text/markdown', 'Markdown'], ['ics', 'text/calendar', 'iCalendar'], ['vcf', 'text/vcard', 'vCard'],
  ['yaml', 'application/yaml', 'YAML'], ['yml', 'application/yaml', 'YAML'], ['toml', 'application/toml', 'TOML'],
  ['wasm', 'application/wasm', 'WebAssembly'], ['webmanifest', 'application/manifest+json', 'Web app manifest'],
  ['pdf', 'application/pdf', 'PDF'], ['rtf', 'application/rtf', 'Rich Text'], ['epub', 'application/epub+zip', 'EPUB e-book'],
  ['zip', 'application/zip', 'ZIP archive'], ['gz', 'application/gzip', 'GZIP'], ['tar', 'application/x-tar', 'TAR archive'],
  ['7z', 'application/x-7z-compressed', '7-Zip'], ['rar', 'application/vnd.rar', 'RAR'], ['bz2', 'application/x-bzip2', 'BZIP2'],
  ['xz', 'application/x-xz', 'XZ'], ['doc', 'application/msword', 'Word 97–2003'],
  ['docx', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'Word document'],
  ['xls', 'application/vnd.ms-excel', 'Excel 97–2003'], ['xlsx', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'Excel workbook'],
  ['ppt', 'application/vnd.ms-powerpoint', 'PowerPoint 97–2003'], ['pptx', 'application/vnd.openxmlformats-officedocument.presentationml.presentation', 'PowerPoint presentation'],
  ['odt', 'application/vnd.oasis.opendocument.text', 'OpenDocument text'], ['ods', 'application/vnd.oasis.opendocument.spreadsheet', 'OpenDocument spreadsheet'],
  ['odp', 'application/vnd.oasis.opendocument.presentation', 'OpenDocument presentation'],
  ['png', 'image/png', 'PNG image'], ['jpg', 'image/jpeg', 'JPEG image'], ['jpeg', 'image/jpeg', 'JPEG image'], ['gif', 'image/gif', 'GIF image'],
  ['webp', 'image/webp', 'WebP image'], ['avif', 'image/avif', 'AVIF image'], ['svg', 'image/svg+xml', 'SVG image'], ['ico', 'image/vnd.microsoft.icon', 'Icon'],
  ['bmp', 'image/bmp', 'Bitmap'], ['tif', 'image/tiff', 'TIFF image'], ['tiff', 'image/tiff', 'TIFF image'], ['heic', 'image/heic', 'HEIC image'], ['heif', 'image/heif', 'HEIF image'],
  ['mp3', 'audio/mpeg', 'MP3 audio'], ['wav', 'audio/wav', 'WAV audio'], ['ogg', 'audio/ogg', 'Ogg audio'], ['oga', 'audio/ogg', 'Ogg audio'],
  ['opus', 'audio/opus', 'Opus audio'], ['flac', 'audio/flac', 'FLAC audio'], ['aac', 'audio/aac', 'AAC audio'], ['m4a', 'audio/mp4', 'MPEG-4 audio'],
  ['mid', 'audio/midi', 'MIDI'], ['midi', 'audio/midi', 'MIDI'], ['weba', 'audio/webm', 'WebM audio'],
  ['mp4', 'video/mp4', 'MPEG-4 video'], ['m4v', 'video/mp4', 'MPEG-4 video'], ['webm', 'video/webm', 'WebM video'], ['ogv', 'video/ogg', 'Ogg video'],
  ['mov', 'video/quicktime', 'QuickTime video'], ['avi', 'video/x-msvideo', 'AVI video'], ['mkv', 'video/x-matroska', 'Matroska video'],
  ['mpeg', 'video/mpeg', 'MPEG video'], ['3gp', 'video/3gpp', '3GPP video'], ['ts', 'video/mp2t', 'MPEG transport stream'],
  ['woff', 'font/woff', 'WOFF font'], ['woff2', 'font/woff2', 'WOFF2 font'], ['ttf', 'font/ttf', 'TrueType font'], ['otf', 'font/otf', 'OpenType font'],
  ['eot', 'application/vnd.ms-fontobject', 'Embedded OpenType'], ['bin', 'application/octet-stream', 'Binary data'],
  ['exe', 'application/vnd.microsoft.portable-executable', 'Windows executable'], ['dmg', 'application/x-apple-diskimage', 'macOS disk image'],
  ['apk', 'application/vnd.android.package-archive', 'Android package'], ['jar', 'application/java-archive', 'Java archive'],
  ['sh', 'application/x-sh', 'Shell script'], ['php', 'application/x-httpd-php', 'PHP'], ['sql', 'application/sql', 'SQL'],
  ['gpx', 'application/gpx+xml', 'GPS track'], ['kml', 'application/vnd.google-earth.kml+xml', 'KML'], ['rss', 'application/rss+xml', 'RSS feed'],
  ['atom', 'application/atom+xml', 'Atom feed'], ['eml', 'message/rfc822', 'Email message'],
];

// ---------------------------------------------------------------- URL cleaner

export const TRACKER_GROUPS: Record<string, { label: string; match: (k: string) => boolean }> = {
  utm: { label: 'Campaign tags (utm_*)', match: (k) => k.startsWith('utm_') },
  ads: { label: 'Ad click IDs (gclid, fbclid, msclkid, dclid, yclid, twclid, ttclid, li_fat_id…)', match: (k) => ['gclid', 'gclsrc', 'dclid', 'gbraid', 'wbraid', 'fbclid', 'msclkid', 'yclid', 'twclid', 'ttclid', 'li_fat_id', 'epik', 'irclickid'].includes(k) },
  email: { label: 'Email tracking (mc_cid, mc_eid, _hsenc, _hsmi, mkt_tok, vero_id)', match: (k) => ['mc_cid', 'mc_eid', '_hsenc', '_hsmi', 'mkt_tok', 'vero_id', 'vero_conv', 'oly_enc_id', 'oly_anon_id', 'rb_clickid', 's_cid'].includes(k) },
  social: { label: 'Social share IDs (igshid, si, share_id, ref_src)', match: (k) => ['igshid', 'igsh', 'si', 'share_id', 'ref_src', 'ref_url', 'feature', 'xmt'].includes(k) },
  analytics: { label: 'Analytics (_ga, _gl, _ke, spm, scm, pk_*, mtm_*)', match: (k) => ['_ga', '_gl', '_ke', 'spm', 'scm'].includes(k) || k.startsWith('pk_') || k.startsWith('mtm_') || k.startsWith('piwik_') },
  ref: { label: 'Generic referral (ref, source) — may break some sites', match: (k) => ['ref', 'source', 'src'].includes(k) },
};

export function cleanUrl(input: string, groups: string[]): { url: string; removed: string[] } {
  const url = new URL(input.trim());
  const removed: string[] = [];
  for (const key of [...new Set([...url.searchParams.keys()])]) {
    const k = key.toLowerCase();
    if (groups.some((g) => TRACKER_GROUPS[g]?.match(k))) {
      url.searchParams.delete(key);
      removed.push(key);
    }
  }
  // Fragments used for tracking (e.g. #utm_…) are rare; leave the hash intact.
  let href = url.href;
  if (!url.searchParams.toString()) href = href.replace(/\?(?=#|$)/, '');
  return { url: href, removed };
}

// ---------------------------------------------------------------- Meta tags

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

export function metaTags(o: { title: string; description: string; url: string; image: string; imageAlt: string; siteName: string; type: string; twitterCard: string; twitterSite: string; locale: string }): { html: string; warnings: string[] } {
  const warnings: string[] = [];
  if (!o.title.trim()) throw new Error('A title is required.');
  if (o.title.length > 60) warnings.push(`Title is ${o.title.length} characters; search results often cut off around 60.`);
  if (o.description.length > 160) warnings.push(`Description is ${o.description.length} characters; around 150–160 is typical before truncation.`);
  for (const [label, v] of [['Page URL', o.url], ['Image URL', o.image]] as const) {
    if (v.trim()) {
      try {
        const u = new URL(v.trim());
        if (!/^https?:$/.test(u.protocol)) warnings.push(`${label} should use http(s).`);
      } catch {
        warnings.push(`${label} must be an absolute URL (Open Graph requires absolute URLs).`);
      }
    }
  }
  if (o.image.trim() && !o.imageAlt.trim()) warnings.push('Add image alt text for accessibility.');
  const tags: string[] = [`<title>${esc(o.title)}</title>`];
  const meta = (attr: 'name' | 'property', key: string, val: string) => val.trim() && tags.push(`<meta ${attr}="${key}" content="${esc(val.trim())}">`);
  meta('name', 'description', o.description);
  if (o.url.trim()) tags.push(`<link rel="canonical" href="${esc(o.url.trim())}">`);
  meta('property', 'og:type', o.type || 'website');
  meta('property', 'og:title', o.title);
  meta('property', 'og:description', o.description);
  meta('property', 'og:url', o.url);
  meta('property', 'og:site_name', o.siteName);
  meta('property', 'og:locale', o.locale);
  meta('property', 'og:image', o.image);
  meta('property', 'og:image:alt', o.imageAlt);
  meta('name', 'twitter:card', o.twitterCard || (o.image.trim() ? 'summary_large_image' : 'summary'));
  meta('name', 'twitter:site', o.twitterSite);
  meta('name', 'twitter:title', o.title);
  meta('name', 'twitter:description', o.description);
  meta('name', 'twitter:image', o.image);
  meta('name', 'twitter:image:alt', o.imageAlt);
  return { html: tags.join('\n'), warnings };
}

// ---------------------------------------------------------------- robots.txt & sitemap

export function robotsTxt(groups: Array<{ agent: string; allow: string; disallow: string }>, sitemaps: string): string {
  const lines: string[] = [];
  groups.forEach((g, gi) => {
    const agent = g.agent.trim() || '*';
    if (/[\r\n]/.test(agent)) throw new Error('User-agent must be on one line.');
    if (gi) lines.push('');
    lines.push(`User-agent: ${agent}`);
    const paths = (s: string) => s.split(/\r?\n/).map((p) => p.trim()).filter(Boolean);
    const allow = paths(g.allow);
    const disallow = paths(g.disallow);
    for (const p of [...allow, ...disallow]) if (!p.startsWith('/') && !p.startsWith('*')) throw new Error(`Path “${p}” should start with “/”.`);
    allow.forEach((p) => lines.push(`Allow: ${p}`));
    disallow.forEach((p) => lines.push(`Disallow: ${p}`));
    if (!allow.length && !disallow.length) lines.push('Disallow:');
  });
  const maps = sitemaps.split(/\r?\n/).map((s) => s.trim()).filter(Boolean);
  for (const m of maps) {
    try {
      new URL(m);
    } catch {
      throw new Error(`Sitemap “${m}” must be an absolute URL.`);
    }
  }
  if (maps.length) lines.push('', ...maps.map((m) => `Sitemap: ${m}`));
  return lines.join('\n') + '\n';
}

const xmlEsc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;');

export function sitemapXml(urlsText: string, o: { lastmod: string; changefreq: string; priority: string }): { xml: string; count: number; warnings: string[] } {
  const raw = urlsText.split(/\r?\n/).map((s) => s.trim()).filter(Boolean);
  if (!raw.length) throw new Error('Paste at least one URL (one per line).');
  if (raw.length > 50_000) throw new Error('A single sitemap may contain at most 50,000 URLs.');
  const warnings: string[] = [];
  const seen = new Set<string>();
  const origins = new Set<string>();
  const entries: string[] = [];
  raw.forEach((r, i) => {
    let u: URL;
    try {
      u = new URL(r);
    } catch {
      throw new Error(`Line ${i + 1}: “${r.slice(0, 60)}” is not an absolute URL.`);
    }
    if (!/^https?:$/.test(u.protocol)) throw new Error(`Line ${i + 1}: only http(s) URLs belong in a sitemap.`);
    if (seen.has(u.href)) return;
    seen.add(u.href);
    origins.add(u.origin);
    let e = `  <url>\n    <loc>${xmlEsc(u.href)}</loc>`;
    if (o.lastmod) e += `\n    <lastmod>${xmlEsc(o.lastmod)}</lastmod>`;
    if (o.changefreq) e += `\n    <changefreq>${o.changefreq}</changefreq>`;
    if (o.priority) e += `\n    <priority>${o.priority}</priority>`;
    entries.push(e + '\n  </url>');
  });
  if (origins.size > 1) warnings.push(`URLs span ${origins.size} different hosts; a sitemap should normally cover one site.`);
  if (raw.length !== seen.size) warnings.push(`${raw.length - seen.size} duplicate URL(s) removed.`);
  const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${entries.join('\n')}\n</urlset>\n`;
  if (new TextEncoder().encode(xml).length > 50 * 1024 * 1024) warnings.push('The file is over 50 MB uncompressed, the sitemap limit.');
  return { xml, count: entries.length, warnings };
}

// ---------------------------------------------------------------- User agent (heuristic)

export function parseUserAgent(ua: string) {
  const s = ua.trim();
  if (!s) throw new Error('Paste a user-agent string.');
  const find = (re: RegExp) => s.match(re)?.[1];
  let browser = 'Unknown';
  let version = '';
  const tests: Array<[string, RegExp]> = [
    ['Samsung Internet', /SamsungBrowser\/([\d.]+)/],
    ['Opera', /(?:OPR|Opera)\/([\d.]+)/],
    ['Microsoft Edge', /Edg(?:e|A|iOS)?\/([\d.]+)/],
    ['Vivaldi', /Vivaldi\/([\d.]+)/],
    ['Yandex Browser', /YaBrowser\/([\d.]+)/],
    ['Firefox', /(?:Firefox|FxiOS)\/([\d.]+)/],
    ['Chrome', /(?:Chrome|CriOS)\/([\d.]+)/],
    ['Safari', /Version\/([\d.]+).*Safari/],
    ['Internet Explorer', /(?:MSIE |rv:)([\d.]+).*Trident/],
  ];
  for (const [name, re] of tests) {
    const v = find(re);
    if (v) {
      browser = name;
      version = v;
      break;
    }
  }
  const bot = /bot|crawler|spider|crawling|slurp|facebookexternalhit|embedly|curl|wget|python-requests|httpclient/i.test(s);
  let os = 'Unknown';
  if (/Windows NT 10\.0/.test(s)) os = 'Windows 10 or 11';
  else if (/Windows NT 6\.3/.test(s)) os = 'Windows 8.1';
  else if (/Windows NT 6\.1/.test(s)) os = 'Windows 7';
  else if (/Windows/.test(s)) os = 'Windows';
  else if (/iPhone|iPad|iPod/.test(s)) os = `iOS ${find(/OS (\d+[_\d]*)/)?.replace(/_/g, '.') ?? ''}`.trim();
  else if (/Android/.test(s)) os = `Android ${find(/Android ([\d.]+)/) ?? ''}`.trim();
  else if (/CrOS/.test(s)) os = 'ChromeOS';
  else if (/Mac OS X/.test(s)) os = `macOS ${find(/Mac OS X (\d+[_.\d]*)/)?.replace(/_/g, '.') ?? ''}`.trim();
  else if (/Linux/.test(s)) os = 'Linux';
  let engine = 'Unknown';
  if (/Gecko\/\d/.test(s) && /Firefox/.test(s)) engine = 'Gecko';
  else if (/AppleWebKit/.test(s) && /(Chrome|CriOS|Edg|OPR)/.test(s) && !/iPhone|iPad/.test(s)) engine = 'Blink';
  else if (/AppleWebKit/.test(s)) engine = 'WebKit';
  else if (/Trident/.test(s)) engine = 'Trident';
  const device = bot ? 'Bot / crawler' : /iPad|Tablet/.test(s) || (/Android/.test(s) && !/Mobile/.test(s)) ? 'Tablet' : /Mobi|iPhone|Android/.test(s) ? 'Mobile' : 'Desktop';
  const notes: string[] = [];
  if (/iPhone|iPad/.test(s) && browser !== 'Safari') notes.push('On iOS every browser uses Apple’s WebKit engine.');
  if (/Mac OS X 10[._]15[._]7/.test(s)) notes.push('Browsers freeze the macOS version at 10.15.7, so the real version may be newer.');
  if (/Windows NT 10\.0/.test(s)) notes.push('Windows 10 and 11 report the same version string.');
  if (/Android 10; K\)/.test(s)) notes.push('Chrome reduces Android details (“Android 10; K”), so the real version and model are hidden.');
  return { browser, version, engine, os, device, bot, notes };
}

// ---------------------------------------------------------------- HTTP status codes

export const HTTP_STATUS: Array<[number, string, string]> = [
  [100, 'Continue', 'The server received the request headers; the client should send the body.'],
  [101, 'Switching Protocols', 'The server is switching protocols as requested (e.g. to WebSocket).'],
  [103, 'Early Hints', 'Preliminary headers so the browser can start preloading resources.'],
  [200, 'OK', 'The request succeeded.'],
  [201, 'Created', 'A new resource was created.'],
  [202, 'Accepted', 'The request was accepted for processing, which is not finished.'],
  [204, 'No Content', 'Success with no response body.'],
  [206, 'Partial Content', 'Part of the resource is returned (range request).'],
  [301, 'Moved Permanently', 'The resource has a new permanent URL.'],
  [302, 'Found', 'Temporary redirect; clients may change POST to GET.'],
  [303, 'See Other', 'Redirect to another URL using GET, often after a form POST.'],
  [304, 'Not Modified', 'The cached copy is still valid.'],
  [307, 'Temporary Redirect', 'Temporary redirect keeping the same method and body.'],
  [308, 'Permanent Redirect', 'Permanent redirect keeping the same method and body.'],
  [400, 'Bad Request', 'The request is malformed.'],
  [401, 'Unauthorized', 'Authentication is required or failed.'],
  [403, 'Forbidden', 'The server understood the request but refuses it.'],
  [404, 'Not Found', 'No resource exists at this URL.'],
  [405, 'Method Not Allowed', 'The HTTP method is not supported for this resource.'],
  [406, 'Not Acceptable', 'No representation matches the Accept headers.'],
  [408, 'Request Timeout', 'The server timed out waiting for the request.'],
  [409, 'Conflict', 'The request conflicts with the current state of the resource.'],
  [410, 'Gone', 'The resource was removed permanently.'],
  [411, 'Length Required', 'A Content-Length header is required.'],
  [412, 'Precondition Failed', 'A conditional header (If-Match…) did not match.'],
  [413, 'Content Too Large', 'The request body is larger than the server allows.'],
  [414, 'URI Too Long', 'The URL is longer than the server accepts.'],
  [415, 'Unsupported Media Type', 'The body’s content type is not supported.'],
  [416, 'Range Not Satisfiable', 'The requested byte range is outside the resource.'],
  [418, "I'm a teapot", 'An April Fools’ joke code (RFC 2324); not for real use.'],
  [421, 'Misdirected Request', 'The request reached a server that cannot answer for this host.'],
  [422, 'Unprocessable Content', 'The request is well-formed but has semantic errors (e.g. validation).'],
  [425, 'Too Early', 'The server will not process a request that might be replayed.'],
  [426, 'Upgrade Required', 'The client must switch to another protocol.'],
  [428, 'Precondition Required', 'The request must be conditional.'],
  [429, 'Too Many Requests', 'Rate limit exceeded; see Retry-After.'],
  [431, 'Request Header Fields Too Large', 'Headers are too large.'],
  [451, 'Unavailable For Legal Reasons', 'Blocked for legal reasons.'],
  [500, 'Internal Server Error', 'A generic server error.'],
  [501, 'Not Implemented', 'The server does not support the functionality required.'],
  [502, 'Bad Gateway', 'An upstream server returned an invalid response.'],
  [503, 'Service Unavailable', 'The server is overloaded or down for maintenance.'],
  [504, 'Gateway Timeout', 'An upstream server did not respond in time.'],
  [505, 'HTTP Version Not Supported', 'The HTTP version is not supported.'],
  [507, 'Insufficient Storage', 'The server cannot store the representation (WebDAV).'],
  [508, 'Loop Detected', 'An infinite loop was detected (WebDAV).'],
  [511, 'Network Authentication Required', 'The client must log in to the network (captive portal).'],
];

// ---------------------------------------------------------------- Data URIs

export function parseDataUri(input: string): { mime: string; base64: boolean; bytes: Uint8Array; params: string } {
  const s = input.trim();
  const m = s.match(/^data:([^,]*?),([\s\S]*)$/i);
  if (!m) throw new Error('A data URI starts with “data:” and has a comma before the data.');
  const meta = m[1];
  const base64 = /;base64$/i.test(meta);
  const head = base64 ? meta.replace(/;base64$/i, '') : meta;
  const mime = (head.split(';')[0] || 'text/plain').toLowerCase();
  const params = head.split(';').slice(1).join(';');
  let bytes: Uint8Array;
  if (base64) {
    const b = m[2].replace(/\s+/g, '');
    if (!/^[A-Za-z0-9+/]*={0,2}$/.test(b)) throw new Error('The Base64 part contains invalid characters.');
    const bin = atob(b);
    bytes = Uint8Array.from(bin, (c) => c.charCodeAt(0));
  } else {
    // Percent-decoding to raw bytes (works for any charset).
    const out: number[] = [];
    const enc = new TextEncoder();
    for (let i = 0; i < m[2].length; i++) {
      const c = m[2][i];
      if (c === '%') {
        const hex = m[2].slice(i + 1, i + 3);
        if (!/^[0-9a-fA-F]{2}$/.test(hex)) throw new Error('The data part has invalid percent-encoding.');
        out.push(parseInt(hex, 16));
        i += 2;
      } else out.push(...enc.encode(c));
    }
    bytes = Uint8Array.from(out);
  }
  return { mime, base64, bytes, params };
}

export function textToDataUri(text: string, mime: string, base64: boolean): string {
  const m = mime.trim() || 'text/plain';
  if (!/^[\w.+-]+\/[\w.+-]+$/.test(m)) throw new Error('MIME type should look like text/plain.');
  if (base64) {
    const bytes = new TextEncoder().encode(text);
    let bin = '';
    for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
    return `data:${m};charset=utf-8;base64,${btoa(bin)}`;
  }
  return `data:${m};charset=utf-8,${encodeURIComponent(text)}`;
}
