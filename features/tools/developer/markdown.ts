/**
 * Small, safe Markdown renderer.
 * Security model: the whole source is HTML-escaped FIRST, so no raw HTML from the
 * input can ever reach the output. Only tags generated here are emitted, and link
 * URLs are restricted to http(s), mailto, fragment and relative paths.
 * Images are rendered as links so the preview never loads remote content.
 */

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

/** Takes an already-escaped URL and returns it if safe, else null. */
export function safeUrl(escapedUrl: string): string | null {
  const raw = escapedUrl.replace(/&amp;/g, '&');
  // eslint-disable-next-line no-control-regex
  const probe = raw.replace(/[\u0000- \u007F]+/g, '').toLowerCase();
  const scheme = probe.match(/^([a-z][a-z0-9+.-]*):/);
  if (scheme && !['http', 'https', 'mailto'].includes(scheme[1])) return null;
  if (probe.startsWith('//')) return null; // protocol-relative: treat as unsafe/ambiguous
  return escapedUrl;
}

function inline(escaped: string): string {
  const slots: string[] = [];
  const hold = (html: string) => `\u0000${slots.push(html) - 1}\u0000`;
  let s = escaped;

  // Code spans first: their content is not processed further.
  s = s.replace(/(`+)([\s\S]*?[^`])\1(?!`)/g, (_m, _t, code: string) => hold(`<code>${code.trim()}</code>`));

  // Images → links (never load remote images).
  s = s.replace(/!\[([^\]]*)\]\(\s*([^)\s]+)(?:\s+&quot;[^)]*?&quot;)?\s*\)/g, (_m, alt: string, url: string) => {
    const u = safeUrl(url);
    const label = `Image: ${alt || 'untitled'}`;
    return u ? hold(`<a href="${u}" rel="noopener noreferrer nofollow" target="_blank">${label}</a>`) : label;
  });

  // Links.
  s = s.replace(/\[([^\]]+)\]\(\s*([^)\s]+)(?:\s+&quot;([^)]*?)&quot;)?\s*\)/g, (_m, text: string, url: string, title?: string) => {
    const u = safeUrl(url);
    if (!u) return text;
    const t = title ? ` title="${title}"` : '';
    return hold(`<a href="${u}"${t} rel="noopener noreferrer nofollow" target="_blank">${emphasis(text)}</a>`);
  });

  // Autolinks <https://…>
  s = s.replace(/&lt;(https?:\/\/[^\s]+?)&gt;/g, (_m, url: string) => hold(`<a href="${url}" rel="noopener noreferrer nofollow" target="_blank">${url}</a>`));

  s = emphasis(s);
  s = s.replace(/(?: {2,}|\\)\n/g, '<br>\n');
  return s.replace(/\u0000(\d+)\u0000/g, (_m, i: string) => slots[Number(i)]);
}

function emphasis(s: string): string {
  return s
    .replace(/\*\*(?=\S)([\s\S]*?\S)\*\*/g, '<strong>$1</strong>')
    .replace(/(^|[^\p{L}\p{N}_])__(?=\S)([\s\S]*?\S)__(?![\p{L}\p{N}_])/gu, '$1<strong>$2</strong>')
    .replace(/\*(?=\S)([^*]*?\S)\*/g, '<em>$1</em>')
    .replace(/(^|[^\p{L}\p{N}_])_(?=\S)([^_]*?\S)_(?![\p{L}\p{N}_])/gu, '$1<em>$2</em>')
    .replace(/~~(?=\S)([\s\S]*?\S)~~/g, '<del>$1</del>');
}

const RE = {
  fence: /^ {0,3}(```|~~~)\s*([\w+-]*)\s*$/,
  heading: /^ {0,3}(#{1,6})\s+(.*?)\s*#*\s*$/,
  hr: /^ {0,3}([-*_])(\s*\1){2,}\s*$/,
  quote: /^ {0,3}&gt;\s?/,
  list: /^( *)([-*+]|\d{1,9}[.)])\s+(.*)$/,
  tableSep: /^\s*\|?\s*:?-{1,}:?\s*(\|\s*:?-{1,}:?\s*)*\|?\s*$/,
};

function splitRow(line: string): string[] {
  let t = line.trim();
  if (t.startsWith('|')) t = t.slice(1);
  if (t.endsWith('|') && !t.endsWith('\\|')) t = t.slice(0, -1);
  return t.split(/(?<!\\)\|/).map((c) => c.trim().replace(/\\\|/g, '|'));
}

function blocks(lines: string[]): string {
  const out: string[] = [];
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    if (line.trim() === '') {
      i++;
      continue;
    }
    let m: RegExpMatchArray | null;

    if ((m = line.match(RE.fence))) {
      const fence = m[1];
      const lang = m[2];
      const body: string[] = [];
      i++;
      while (i < lines.length && !lines[i].trim().startsWith(fence)) body.push(lines[i++]);
      i++;
      out.push(`<pre><code${lang ? ` class="language-${lang}"` : ''}>${body.join('\n')}</code></pre>`);
      continue;
    }
    if ((m = line.match(RE.heading))) {
      const level = m[1].length;
      out.push(`<h${level}>${inline(m[2])}</h${level}>`);
      i++;
      continue;
    }
    if (RE.hr.test(line)) {
      out.push('<hr>');
      i++;
      continue;
    }
    if (RE.quote.test(line)) {
      const inner: string[] = [];
      while (i < lines.length && lines[i].trim() !== '' && (RE.quote.test(lines[i]) || inner.length > 0)) {
        inner.push(lines[i].replace(RE.quote, ''));
        i++;
      }
      out.push(`<blockquote>${blocks(inner)}</blockquote>`);
      continue;
    }
    if ((m = line.match(RE.list))) {
      const ordered = /\d/.test(m[2]);
      const baseIndent = m[1].length;
      const items: string[][] = [];
      const start = ordered ? parseInt(m[2], 10) : 1;
      while (i < lines.length) {
        const lm = lines[i].match(RE.list);
        if (lm && lm[1].length === baseIndent && /\d/.test(lm[2]) === ordered) {
          items.push([lm[3]]);
          i++;
          continue;
        }
        if (items.length && lines[i].trim() !== '' && (lines[i].length - lines[i].trimStart().length > baseIndent || !RE.list.test(lines[i]))) {
          if (!/^\s/.test(lines[i]) && lines[i - 1]?.trim() === '') break;
          items[items.length - 1].push(lines[i].slice(Math.min(baseIndent + 2, lines[i].length - lines[i].trimStart().length)));
          i++;
          continue;
        }
        if (lines[i].trim() === '' && lines[i + 1] && /^\s+/.test(lines[i + 1])) {
          items[items.length - 1].push('');
          i++;
          continue;
        }
        break;
      }
      const tag = ordered ? 'ol' : 'ul';
      const startAttr = ordered && start !== 1 ? ` start="${start}"` : '';
      const lis = items.map((it) => {
        const html = blocks(it);
        const tight = html.match(/^<p>([\s\S]*?)<\/p>([\s\S]*)$/);
        return `<li>${tight && !tight[1].includes('<p>') ? tight[1] + tight[2] : html}</li>`;
      });
      out.push(`<${tag}${startAttr}>${lis.join('')}</${tag}>`);
      continue;
    }
    if (line.includes('|') && i + 1 < lines.length && RE.tableSep.test(lines[i + 1]) && lines[i + 1].includes('-')) {
      const head = splitRow(line);
      const align = splitRow(lines[i + 1]).map((c) => (c.startsWith(':') && c.endsWith(':') ? 'center' : c.endsWith(':') ? 'right' : c.startsWith(':') ? 'left' : ''));
      i += 2;
      const rows: string[][] = [];
      while (i < lines.length && lines[i].trim() !== '' && lines[i].includes('|')) rows.push(splitRow(lines[i++]));
      const cell = (tag: string, c: string, k: number) => `<${tag}${align[k] ? ` style="text-align:${align[k]}"` : ''}>${inline(c)}</${tag}>`;
      out.push(
        `<table><thead><tr>${head.map((c, k) => cell('th', c, k)).join('')}</tr></thead><tbody>${rows
          .map((r) => `<tr>${head.map((_h, k) => cell('td', r[k] ?? '', k)).join('')}</tr>`)
          .join('')}</tbody></table>`,
      );
      continue;
    }
    // Paragraph
    const para: string[] = [];
    while (
      i < lines.length &&
      lines[i].trim() !== '' &&
      !RE.fence.test(lines[i]) &&
      !RE.heading.test(lines[i]) &&
      !RE.hr.test(lines[i]) &&
      !RE.quote.test(lines[i]) &&
      !(para.length > 0 && RE.list.test(lines[i]))
    ) {
      para.push(lines[i]);
      i++;
    }
    if (para.length === 0) {
      para.push(lines[i]);
      i++;
    }
    out.push(`<p>${inline(para.join('\n'))}</p>`);
  }
  return out.join('\n');
}

export function renderMarkdown(src: string): string {
  const escaped = escapeHtml(src.replace(/\r\n|\r/g, '\n').replace(/\t/g, '    '));
  return blocks(escaped.split('\n'));
}
