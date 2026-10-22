/**
 * Lightweight XML well-formedness check and pretty-printer.
 * Checks: tags nest and close correctly, a single root element, no stray text
 * outside the root, quoted attributes, legal-looking names. It does not process
 * DTDs or validate against schemas. Original tag text (attributes) is preserved.
 */
export type XmlNode = Node;
type Node =
  | { kind: 'element'; name: string; open: string; selfClosing: boolean; children: Node[] }
  | { kind: 'text'; text: string }
  | { kind: 'raw'; text: string }; // comment, CDATA, PI, doctype

const NAME = /^[\p{L}_:][\p{L}\p{N}_.:-]*$/u;

function err(src: string, pos: number, msg: string): never {
  let line = 1;
  let col = 1;
  for (let i = 0; i < pos; i++) {
    if (src[i] === '\n') {
      line++;
      col = 1;
    } else col++;
  }
  throw new Error(`Line ${line}, column ${col}: ${msg}`);
}

function readUntil(src: string, from: number, end: string, what: string): number {
  const idx = src.indexOf(end, from);
  if (idx === -1) err(src, from, `${what} is never closed (expected “${end}”).`);
  return idx + end.length;
}

function readTag(src: string, from: number): number {
  let q: string | null = null;
  for (let i = from + 1; i < src.length; i++) {
    const c = src[i];
    if (q) {
      if (c === q) q = null;
    } else if (c === '"' || c === "'") q = c;
    else if (c === '<') err(src, i, 'Unexpected “<” inside a tag.');
    else if (c === '>') return i + 1;
  }
  return err(src, from, 'Tag is never closed with “>”.');
}

export function parseXml(src: string): Node[] {
  const root: Node[] = [];
  const stack: Array<{ node: Extract<Node, { kind: 'element' }>; pos: number }> = [];
  const push = (n: Node) => (stack.length ? stack[stack.length - 1].node.children : root).push(n);
  let i = 0;
  let rootCount = 0;

  while (i < src.length) {
    if (src[i] !== '<') {
      const next = src.indexOf('<', i);
      const end = next === -1 ? src.length : next;
      const text = src.slice(i, end);
      if (!stack.length && text.trim()) err(src, i, 'Text is not allowed outside the root element.');
      if (/&(?!(?:[a-zA-Z][\w.-]*|#\d+|#x[0-9a-fA-F]+);)/.test(text)) err(src, i + text.search(/&(?!(?:[a-zA-Z][\w.-]*|#\d+|#x[0-9a-fA-F]+);)/), 'A bare “&” must be written as &amp;.');
      push({ kind: 'text', text });
      i = end;
      continue;
    }
    if (src.startsWith('<!--', i)) {
      const end = readUntil(src, i + 4, '-->', 'Comment');
      push({ kind: 'raw', text: src.slice(i, end) });
      i = end;
      continue;
    }
    if (src.startsWith('<![CDATA[', i)) {
      if (!stack.length) err(src, i, 'CDATA is only allowed inside an element.');
      const end = readUntil(src, i + 9, ']]>', 'CDATA section');
      push({ kind: 'raw', text: src.slice(i, end) });
      i = end;
      continue;
    }
    if (src.startsWith('<?', i)) {
      const end = readUntil(src, i + 2, '?>', 'Processing instruction');
      push({ kind: 'raw', text: src.slice(i, end) });
      i = end;
      continue;
    }
    if (src.startsWith('<!', i)) {
      // DOCTYPE, possibly with an internal subset in brackets.
      let depth = 0;
      let j = i + 2;
      for (; j < src.length; j++) {
        if (src[j] === '[') depth++;
        else if (src[j] === ']') depth--;
        else if (src[j] === '>' && depth <= 0) break;
      }
      if (j >= src.length) err(src, i, 'Declaration is never closed.');
      push({ kind: 'raw', text: src.slice(i, j + 1) });
      i = j + 1;
      continue;
    }
    if (src[i + 1] === '/') {
      const end = readTag(src, i);
      const name = src.slice(i + 2, end - 1).trim();
      const top = stack.pop();
      if (!top) err(src, i, `Closing tag </${name}> has no matching opening tag.`);
      if (top.node.name !== name) err(src, i, `Expected </${top.node.name}> but found </${name}>.`);
      i = end;
      continue;
    }
    const end = readTag(src, i);
    const raw = src.slice(i, end);
    const selfClosing = /\/\s*>$/.test(raw);
    const inner = raw.slice(1, selfClosing ? raw.lastIndexOf('/') : -1);
    const name = inner.trim().split(/\s+/)[0] ?? '';
    if (!NAME.test(name)) err(src, i, `“${name || '<'}” is not a valid element name.`);
    const attrs = inner.trim().slice(name.length);
    const attrRe = /\s+([\p{L}_:][\p{L}\p{N}_.:-]*)\s*=\s*("[^"]*"|'[^']*')/uy;
    let k = 0;
    const seen = new Set<string>();
    while (k < attrs.length) {
      if (/^\s*$/.test(attrs.slice(k))) break;
      attrRe.lastIndex = k;
      const am = attrRe.exec(attrs);
      if (!am) err(src, i, `Malformed attribute in <${name}> (attributes need name="value").`);
      if (seen.has(am[1])) err(src, i, `Attribute “${am[1]}” appears twice in <${name}>.`);
      seen.add(am[1]);
      k = attrRe.lastIndex;
    }
    if (!stack.length) {
      rootCount++;
      if (rootCount > 1) err(src, i, 'XML must have exactly one root element.');
    }
    const node = { kind: 'element' as const, name, open: raw, selfClosing, children: [] as Node[] };
    push(node);
    if (!selfClosing) stack.push({ node, pos: i });
    i = end;
  }
  if (stack.length) err(src, stack[stack.length - 1].pos, `<${stack[stack.length - 1].node.name}> is never closed.`);
  if (rootCount === 0) throw new Error('No root element found.');
  return root;
}

function print(nodes: Node[], indent: string, depth: number, out: string[]) {
  const pad = indent.repeat(depth);
  for (const n of nodes) {
    if (n.kind === 'text') {
      const t = n.text.trim();
      if (t) out.push(pad + t.replace(/\s*\n\s*/g, ' '));
    } else if (n.kind === 'raw') out.push(pad + n.text.trim());
    else if (n.selfClosing) out.push(pad + n.open);
    else {
      const meaningful = n.children.filter((c) => c.kind !== 'text' || c.text.trim());
      if (meaningful.length === 0) out.push(`${pad}${n.open}</${n.name}>`);
      else if (meaningful.length === 1 && meaningful[0].kind === 'text') out.push(`${pad}${n.open}${meaningful[0].text.trim()}</${n.name}>`);
      else {
        out.push(pad + n.open);
        print(n.children, indent, depth + 1, out);
        out.push(`${pad}</${n.name}>`);
      }
    }
  }
}

function minify(nodes: Node[]): string {
  return nodes
    .map((n) => {
      if (n.kind === 'text') return n.text.trim() ? n.text.replace(/\s+/g, ' ').trim() : '';
      if (n.kind === 'raw') return n.text.startsWith('<!--') ? '' : n.text;
      if (n.selfClosing) return n.open;
      return n.open + minify(n.children) + `</${n.name}>`;
    })
    .join('');
}

export function formatXml(src: string, o: { indent: '2' | '4' | 'tab' | 'minify' }): string {
  const nodes = parseXml(src.replace(/\r\n|\r/g, '\n'));
  if (o.indent === 'minify') return minify(nodes);
  const out: string[] = [];
  print(nodes, o.indent === 'tab' ? '\t' : ' '.repeat(Number(o.indent)), 0, out);
  return out.join('\n');
}
