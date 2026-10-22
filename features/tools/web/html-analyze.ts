/**
 * Static checks on pasted HTML. The markup is scanned as text — it is never
 * rendered, fetched or run — so scripts, images and iframes in it stay inert.
 */

export interface Tag {
  name: string;
  attrs: Record<string, string>;
  /** Visible text inside the element (only filled for a few elements we report on). */
  text: string;
  line: number;
}

export type Severity = 'error' | 'warn' | 'info';
export interface Finding {
  severity: Severity;
  area: string;
  message: string;
  line?: number;
}

export interface HtmlReport {
  meta: Array<{ label: string; value: string }>;
  headings: Array<{ level: number; text: string; line: number }>;
  links: Array<{ href: string; text: string; kind: 'internal' | 'external' | 'anchor' | 'mailto' | 'tel' | 'javascript' | 'other'; line: number }>;
  images: Array<{ src: string; alt: string | null; line: number }>;
  resources: Array<{ kind: string; url: string; line: number }>;
  counts: Record<string, number>;
  findings: Finding[];
  words: number;
}

const VOID = new Set(['area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'link', 'meta', 'source', 'track', 'wbr', 'param']);
const RAW = new Set(['script', 'style', 'textarea', 'title']);
/** Elements whose end tag may be left out (HTML spec "optional end tags"). */
const OPTIONAL_END = new Set(['p', 'li', 'dt', 'dd', 'option', 'optgroup', 'tr', 'td', 'th', 'thead', 'tbody', 'tfoot', 'colgroup', 'caption', 'rt', 'rp', 'html', 'head', 'body']);
const TEXT_TAGS = new Set(['a', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'title', 'button', 'label']);

const ENTITIES: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', copy: '©', reg: '®', hellip: '…', mdash: '—', ndash: '–' };
export function decodeEntities(s: string): string {
  return s.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (m, e: string) => {
    if (e[0] === '#') {
      const n = e[1].toLowerCase() === 'x' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10);
      return Number.isFinite(n) && n > 0 && n < 0x110000 ? String.fromCodePoint(n) : m;
    }
    return ENTITIES[e.toLowerCase()] ?? m;
  });
}

export function parseAttrs(s: string): Record<string, string> {
  const out: Record<string, string> = {};
  const re = /([^\s"'<>/=]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+)))?/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(s))) {
    const k = m[1].toLowerCase();
    if (!(k in out)) out[k] = decodeEntities(m[2] ?? m[3] ?? m[4] ?? '');
  }
  return out;
}

const clean = (s: string) => decodeEntities(s.replace(/<[^>]*>/g, ' ')).replace(/\s+/g, ' ').trim();

export function analyzeHtml(src: string): HtmlReport {
  const findings: Finding[] = [];
  const tags: Tag[] = [];
  const counts: Record<string, number> = {};
  const stack: Array<{ name: string; line: number; start: number; tag: Tag }> = [];
  const lineAt = (() => {
    const starts = [0];
    for (let i = 0; i < src.length; i++) if (src[i] === '\n') starts.push(i + 1);
    return (pos: number) => {
      let lo = 0;
      let hi = starts.length - 1;
      while (lo < hi) {
        const mid = (lo + hi + 1) >> 1;
        if (starts[mid] <= pos) lo = mid;
        else hi = mid - 1;
      }
      return lo + 1;
    };
  })();
  let textOut = '';
  let doctype = false;
  let i = 0;
  while (i < src.length) {
    const lt = src.indexOf('<', i);
    if (lt < 0) {
      textOut += src.slice(i);
      break;
    }
    textOut += src.slice(i, lt);
    if (src.startsWith('<!--', lt)) {
      const end = src.indexOf('-->', lt + 4);
      if (end < 0) findings.push({ severity: 'error', area: 'Markup', message: 'A comment “<!--” is never closed.', line: lineAt(lt) });
      i = end < 0 ? src.length : end + 3;
      continue;
    }
    if (/^<!doctype/i.test(src.slice(lt, lt + 9))) {
      doctype = true;
      i = src.indexOf('>', lt) + 1 || src.length;
      continue;
    }
    const m = /^<(\/?)([a-zA-Z][\w:-]*)((?:[^>"']|"[^"]*"|'[^']*')*)>/.exec(src.slice(lt, lt + 20000));
    if (!m) {
      textOut += '<';
      i = lt + 1;
      continue;
    }
    const closing = m[1] === '/';
    const name = m[2].toLowerCase();
    const line = lineAt(lt);
    i = lt + m[0].length;
    if (closing) {
      const idx = stack.map((s) => s.name).lastIndexOf(name);
      if (idx < 0) {
        if (!VOID.has(name)) findings.push({ severity: 'warn', area: 'Markup', message: `Closing tag </${name}> has no matching opening tag.`, line });
        continue;
      }
      for (let k = stack.length - 1; k > idx; k--) {
        if (!OPTIONAL_END.has(stack[k].name)) findings.push({ severity: 'warn', area: 'Markup', message: `<${stack[k].name}> (line ${stack[k].line}) is not closed before </${name}>.`, line });
      }
      const open = stack[idx];
      if (TEXT_TAGS.has(name)) {
        const raw = src.slice(open.start, lt);
        // an image inside a link/button names it through its alt text
        open.tag.text = clean(raw) || (/<img\b[^>]*\balt\s*=\s*(?:"([^"]+)"|'([^']+)')/i.exec(raw)?.slice(1).find(Boolean) ?? '');
      }
      stack.length = idx;
      continue;
    }
    const attrs = parseAttrs(m[3].replace(/\/\s*$/, ''));
    const tag: Tag = { name, attrs, text: '', line };
    tags.push(tag);
    counts[name] = (counts[name] ?? 0) + 1;
    if (RAW.has(name)) {
      const close = src.toLowerCase().indexOf(`</${name}`, i);
      const body = src.slice(i, close < 0 ? src.length : close);
      if (name === 'title' || name === 'textarea') tag.text = clean(body);
      if (name === 'script' && body.trim()) tag.text = body;
      if (name === 'style') tag.text = body;
      if (close < 0) findings.push({ severity: 'error', area: 'Markup', message: `<${name}> is never closed.`, line });
      i = close < 0 ? src.length : src.indexOf('>', close) + 1 || src.length;
      continue;
    }
    if (!VOID.has(name) && !/\/\s*$/.test(m[3])) stack.push({ name, line, start: i, tag });
  }
  for (const s of stack) if (!OPTIONAL_END.has(s.name)) findings.push({ severity: 'warn', area: 'Markup', message: `<${s.name}> is never closed.`, line: s.line });

  const all = (n: string) => tags.filter((t) => t.name === n);
  const first = (n: string) => tags.find((t) => t.name === n);
  const metaBy = (key: 'name' | 'property', v: string) => tags.find((t) => t.name === 'meta' && (t.attrs[key] ?? '').toLowerCase() === v)?.attrs.content;

  // ---- document head
  const meta: HtmlReport['meta'] = [];
  const html = first('html');
  const title = first('title')?.text ?? '';
  const desc = metaBy('name', 'description');
  const charset = tags.find((t) => t.name === 'meta' && ('charset' in t.attrs || /content-type/i.test(t.attrs['http-equiv'] ?? '')));
  const viewport = metaBy('name', 'viewport');
  const canonical = tags.find((t) => t.name === 'link' && /\bcanonical\b/i.test(t.attrs.rel ?? ''))?.attrs.href;
  const robots = metaBy('name', 'robots');
  meta.push({ label: 'Doctype', value: doctype ? 'Yes' : 'Missing' });
  meta.push({ label: 'Language (lang)', value: html?.attrs.lang || '—' });
  meta.push({ label: 'Title', value: title ? `${title} (${title.length} chars)` : '—' });
  meta.push({ label: 'Meta description', value: desc ? `${desc} (${desc.length} chars)` : '—' });
  meta.push({ label: 'Charset', value: charset ? charset.attrs.charset || charset.attrs.content || 'set' : '—' });
  meta.push({ label: 'Viewport', value: viewport || '—' });
  if (canonical) meta.push({ label: 'Canonical', value: canonical });
  if (robots) meta.push({ label: 'Robots', value: robots });
  const og = tags.filter((t) => t.name === 'meta' && /^og:/i.test(t.attrs.property ?? ''));
  const tw = tags.filter((t) => t.name === 'meta' && /^twitter:/i.test(t.attrs.name ?? ''));
  if (og.length) meta.push({ label: 'Open Graph', value: og.map((t) => `${t.attrs.property}=${t.attrs.content ?? ''}`).join(' · ') });
  if (tw.length) meta.push({ label: 'Twitter card', value: tw.map((t) => `${t.attrs.name}=${t.attrs.content ?? ''}`).join(' · ') });

  const isFullPage = !!(html || first('head') || first('body') || doctype);
  if (isFullPage) {
    if (!doctype) findings.push({ severity: 'warn', area: 'Document', message: 'No <!DOCTYPE html> — browsers will use quirks mode.' });
    if (!html?.attrs.lang) findings.push({ severity: 'warn', area: 'Accessibility', message: 'The <html> element has no lang attribute, so screen readers may guess the language.', line: html?.line });
    if (!title) findings.push({ severity: 'warn', area: 'SEO', message: 'No <title>.' });
    else if (title.length > 60) findings.push({ severity: 'info', area: 'SEO', message: `The title is ${title.length} characters; search results usually show about 50–60.` });
    if (!desc) findings.push({ severity: 'info', area: 'SEO', message: 'No meta description.' });
    else if (desc.length > 160) findings.push({ severity: 'info', area: 'SEO', message: `The meta description is ${desc.length} characters; about 160 are usually shown.` });
    if (!charset) findings.push({ severity: 'info', area: 'Document', message: 'No <meta charset>; add <meta charset="utf-8"> near the top of <head>.' });
    if (!viewport) findings.push({ severity: 'info', area: 'Mobile', message: 'No viewport meta tag, so phones will show a zoomed-out desktop layout.' });
    else if (/user-scalable\s*=\s*no|maximum-scale\s*=\s*1(\.0)?\b/i.test(viewport)) findings.push({ severity: 'warn', area: 'Accessibility', message: 'The viewport blocks zooming (user-scalable=no / maximum-scale=1).' });
  }

  // ---- headings
  const headings = tags.filter((t) => /^h[1-6]$/.test(t.name)).map((t) => ({ level: Number(t.name[1]), text: t.text, line: t.line }));
  const h1 = headings.filter((h) => h.level === 1).length;
  if (isFullPage && h1 === 0) findings.push({ severity: 'warn', area: 'Headings', message: 'No <h1> heading.' });
  if (h1 > 1) findings.push({ severity: 'info', area: 'Headings', message: `${h1} <h1> headings; most pages use one.` });
  headings.forEach((h, k) => {
    const prevLevel = k ? headings[k - 1].level : 0;
    if (prevLevel && h.level > prevLevel + 1) findings.push({ severity: 'info', area: 'Headings', message: `Heading level jumps from h${prevLevel} to h${h.level}.`, line: h.line });
    if (!h.text) findings.push({ severity: 'warn', area: 'Headings', message: `Empty <h${h.level}>.`, line: h.line });
  });

  // ---- links
  const links: HtmlReport['links'] = all('a')
    .filter((a) => 'href' in a.attrs)
    .map((a) => {
      const href = a.attrs.href.trim();
      const kind = href.startsWith('#') ? 'anchor' : /^mailto:/i.test(href) ? 'mailto' : /^tel:/i.test(href) ? 'tel' : /^javascript:/i.test(href) ? 'javascript' : /^(https?:)?\/\//i.test(href) ? 'external' : /^[a-z][a-z0-9+.-]*:/i.test(href) ? 'other' : 'internal';
      return { href, text: a.text || a.attrs['aria-label'] || a.attrs.title || '', kind, line: a.line };
    });
  for (const a of all('a')) {
    const label = a.text || a.attrs['aria-label'] || a.attrs.title;
    if ('href' in a.attrs && !label) findings.push({ severity: 'warn', area: 'Accessibility', message: `Link to “${a.attrs.href.slice(0, 60)}” has no text or aria-label.`, line: a.line });
    if (a.attrs.target === '_blank' && !/noopener|noreferrer/i.test(a.attrs.rel ?? '')) findings.push({ severity: 'info', area: 'Security', message: `target="_blank" link without rel="noopener" (${a.attrs.href ?? ''}). Modern browsers imply it, older ones do not.`, line: a.line });
    if (/^\s*javascript:/i.test(a.attrs.href ?? '')) findings.push({ severity: 'warn', area: 'Security', message: 'A javascript: link — use a <button> with a script listener instead.', line: a.line });
    if (/^(click here|here|read more|more|link)$/i.test(label ?? '')) findings.push({ severity: 'info', area: 'Accessibility', message: `Vague link text “${label}”; describe where the link goes.`, line: a.line });
  }

  // ---- images & media
  const images = all('img').map((t) => ({ src: t.attrs.src ?? '', alt: 'alt' in t.attrs ? t.attrs.alt : null, line: t.line }));
  for (const t of all('img')) {
    if (!('alt' in t.attrs)) findings.push({ severity: 'error', area: 'Accessibility', message: `Image “${(t.attrs.src ?? '').slice(0, 60)}” has no alt attribute (use alt="" for decorative images).`, line: t.line });
    if (!t.attrs.width || !t.attrs.height) findings.push({ severity: 'info', area: 'Performance', message: `Image “${(t.attrs.src ?? '').slice(0, 60)}” has no width/height, which can make the page jump while loading.`, line: t.line });
  }
  for (const t of all('iframe')) if (!t.attrs.title) findings.push({ severity: 'warn', area: 'Accessibility', message: 'An <iframe> has no title attribute.', line: t.line });

  // ---- forms
  const labelled = new Set(all('label').map((l) => l.attrs.for).filter(Boolean));
  for (const t of tags.filter((x) => ['input', 'select', 'textarea'].includes(x.name))) {
    const type = (t.attrs.type ?? 'text').toLowerCase();
    if (['hidden', 'submit', 'button', 'reset', 'image'].includes(type)) continue;
    if (!(t.attrs.id && labelled.has(t.attrs.id)) && !t.attrs['aria-label'] && !t.attrs['aria-labelledby'] && !t.attrs.title) findings.push({ severity: 'warn', area: 'Accessibility', message: `A <${t.name}${t.name === 'input' ? ` type="${type}"` : ''}${t.attrs.name ? ` name="${t.attrs.name}"` : ''}> has no linked <label> or aria-label (wrapped labels are fine).`, line: t.line });
  }
  for (const t of all('button')) if (!t.text && !t.attrs['aria-label'] && !t.attrs.title) findings.push({ severity: 'warn', area: 'Accessibility', message: 'A <button> has no text or aria-label.', line: t.line });
  for (const f of all('form')) if ((f.attrs.action ?? '').startsWith('http:')) findings.push({ severity: 'warn', area: 'Security', message: `Form posts over plain http: (${f.attrs.action}).`, line: f.line });

  // ---- ids, inline code, resources
  const ids = new Map<string, number>();
  for (const t of tags) if (t.attrs.id) ids.set(t.attrs.id, (ids.get(t.attrs.id) ?? 0) + 1);
  for (const [id, n] of ids) if (n > 1) findings.push({ severity: 'error', area: 'Markup', message: `id="${id}" is used ${n} times; ids must be unique.` });
  const handlers = tags.filter((t) => Object.keys(t.attrs).some((k) => /^on[a-z]+$/.test(k)));
  if (handlers.length) findings.push({ severity: 'info', area: 'Security', message: `${handlers.length} element${handlers.length > 1 ? 's use' : ' uses'} inline event handlers (onclick=…), which a strict Content-Security-Policy blocks.`, line: handlers[0].line });
  const inlineScripts = all('script').filter((s) => !s.attrs.src && s.text.trim() && !/json/i.test(s.attrs.type ?? ''));
  if (inlineScripts.length) findings.push({ severity: 'info', area: 'Security', message: `${inlineScripts.length} inline <script> block${inlineScripts.length > 1 ? 's' : ''}.`, line: inlineScripts[0].line });
  const styled = tags.filter((t) => 'style' in t.attrs).length;
  if (styled >= 10) findings.push({ severity: 'info', area: 'Maintainability', message: `${styled} elements use inline style="…" attributes.` });
  for (const t of tags) if (/^(font|center|marquee|blink|big|strike|tt|frameset|frame)$/.test(t.name)) findings.push({ severity: 'info', area: 'Markup', message: `<${t.name}> is obsolete in HTML5.`, line: t.line });

  const resources: HtmlReport['resources'] = [];
  for (const t of tags) {
    if (t.name === 'script' && t.attrs.src) resources.push({ kind: 'script', url: t.attrs.src, line: t.line });
    else if (t.name === 'link' && /stylesheet/i.test(t.attrs.rel ?? '') && t.attrs.href) resources.push({ kind: 'stylesheet', url: t.attrs.href, line: t.line });
    else if (t.name === 'link' && /icon/i.test(t.attrs.rel ?? '') && t.attrs.href) resources.push({ kind: 'icon', url: t.attrs.href, line: t.line });
    else if (t.name === 'link' && /preload|preconnect|dns-prefetch/i.test(t.attrs.rel ?? '') && t.attrs.href) resources.push({ kind: t.attrs.rel.toLowerCase(), url: t.attrs.href, line: t.line });
    else if (['iframe', 'video', 'audio', 'source', 'embed'].includes(t.name) && t.attrs.src) resources.push({ kind: t.name, url: t.attrs.src, line: t.line });
  }
  for (const r of resources) if (/^http:\/\//i.test(r.url)) findings.push({ severity: 'warn', area: 'Security', message: `${r.kind} loaded over plain http: (${r.url.slice(0, 80)}) — blocked as mixed content on https pages.`, line: r.line });
  for (const t of all('script')) if (t.attrs.src && /^(https?:)?\/\//.test(t.attrs.src) && !t.attrs.integrity) findings.push({ severity: 'info', area: 'Security', message: `Third-party script without integrity=… (${t.attrs.src.slice(0, 80)}).`, line: t.line });

  const words = clean(textOut).split(' ').filter((w) => /[\p{L}\p{N}]/u.test(w)).length;
  const order: Record<Severity, number> = { error: 0, warn: 1, info: 2 };
  findings.sort((a, b) => order[a.severity] - order[b.severity] || (a.line ?? 0) - (b.line ?? 0));
  return { meta, headings, links, images, resources, counts, findings, words };
}
