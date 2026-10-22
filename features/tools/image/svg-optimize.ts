/**
 * SVG sanitizer + optimizer working on text. The file is parsed with the
 * site's XML parser (never inserted into the page), dangerous parts are
 * removed and the rest is minified. The result is only ever previewed through
 * an <img>, where SVG scripts cannot run anyway.
 */
import { parseXml, type XmlNode } from '@/features/tools/developer/xml';

export interface SvgOptions {
  /** Decimal places kept in coordinates and lengths (0–6). */
  precision: number;
  removeComments: boolean;
  /** <metadata>, editor namespaces (Inkscape, Sodipodi, Sketch, Illustrator…). */
  removeEditorData: boolean;
  /** <title> and <desc> — keep them for accessibility unless the icon is decorative. */
  removeTitleDesc: boolean;
  /** id attributes not referenced from the file. */
  removeUnusedIds: boolean;
  /** Remove links to other files/sites (http(s), //, file paths) in href/xlink:href and CSS url(). */
  removeExternalRefs: boolean;
  /** Turn on to output indented markup instead of one line. */
  pretty: boolean;
}

export const defaultSvgOptions: SvgOptions = {
  precision: 3,
  removeComments: true,
  removeEditorData: true,
  removeTitleDesc: false,
  removeUnusedIds: true,
  removeExternalRefs: true,
  pretty: false,
};

export interface SvgResult {
  svg: string;
  before: number;
  after: number;
  /** Security-relevant removals. */
  removed: string[];
  /** Size-only clean-ups. */
  cleaned: string[];
  width?: string;
  height?: string;
  viewBox?: string;
}

interface El {
  name: string;
  attrs: Array<[string, string]>;
  children: Array<El | { text: string; raw?: boolean }>;
}

const DANGEROUS_ELEMENTS = new Set(['script', 'foreignobject', 'iframe', 'embed', 'object', 'handler', 'listener', 'applet', 'meta', 'link', 'base', 'audio', 'video', 'canvas']);
const EDITOR_NS = /^(inkscape|sodipodi|sketch|ai|i|x|illustrator|graph|a|serif|figma|bx|vectornator|krita|dc|cc|rdf|xmlns:(inkscape|sodipodi|sketch|ai|i|x|illustrator|graph|a|serif|figma|bx|vectornator|krita|dc|cc|rdf))(:|$)/i;
const NUMERIC_ATTRS = new Set(['x', 'y', 'x1', 'y1', 'x2', 'y2', 'cx', 'cy', 'r', 'rx', 'ry', 'width', 'height', 'stroke-width', 'opacity', 'fill-opacity', 'stroke-opacity', 'offset', 'fx', 'fy', 'dx', 'dy', 'stroke-miterlimit', 'font-size', 'stroke-dashoffset']);
const DEFAULTS: Record<string, string> = { 'fill-opacity': '1', 'stroke-opacity': '1', opacity: '1', 'stroke-width': '1', 'fill-rule': 'nonzero', 'clip-rule': 'nonzero', 'stroke-linecap': 'butt', 'stroke-linejoin': 'miter', 'stroke-miterlimit': '4', 'stroke-dasharray': 'none', 'stroke-dashoffset': '0', visibility: 'visible', display: 'inline' };

function parseAttrs(open: string): Array<[string, string]> {
  const out: Array<[string, string]> = [];
  const body = open.replace(/^<[^\s/>]+/, '').replace(/\/?>$/, '');
  const re = /([^\s=]+)\s*=\s*("([^"]*)"|'([^']*)')/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(body))) out.push([m[1], m[3] ?? m[4] ?? '']);
  return out;
}

function toTree(nodes: XmlNode[]): El['children'] {
  return nodes.map((n) => {
    if (n.kind === 'element') return { name: n.name, attrs: parseAttrs(n.open), children: n.selfClosing ? [] : toTree(n.children) } as El;
    if (n.kind === 'text') return { text: n.text };
    return { text: n.text, raw: true };
  });
}

const isEl = (n: El['children'][number]): n is El => 'name' in n;

/** Round a number string to `p` decimals and drop redundant zeros (0.50 → .5). */
export function roundNum(s: string, p: number): string {
  const n = Number(s);
  if (!Number.isFinite(n)) return s;
  let out = String(Number(n.toFixed(p)));
  if (out === '-0') out = '0';
  return out.replace(/^(-?)0\./, '$1.');
}

const NUM_RE = /-?(?:\d+\.?\d*|\.\d+)(?:e[+-]?\d+)?/gi;

const ARGS: Record<string, number> = { m: 2, l: 2, h: 1, v: 1, c: 6, s: 4, q: 4, t: 2, a: 7, z: 0 };

/**
 * Rounds a path's d attribute and removes optional spaces. Relative commands
 * are rounded against the already-rounded pen position, so rounding errors do
 * not add up along the path. Returns the input unchanged if it cannot be read.
 */
export function minifyPath(d: string, p: number): string {
  const re = /\s*([MmLlHhVvCcSsQqTtAaZz])|\s*,?\s*([+-]?(?:\d+\.?\d*|\.\d+)(?:[eE][+-]?\d+)?)/y;
  const flagRe = /\s*,?\s*([01])/y;
  let i = 0;
  let cmd = '';
  const segs: Array<{ c: string; a: number[] }> = [];
  while (i < d.length) {
    if (/^[\s,]*$/.test(d.slice(i))) break;
    re.lastIndex = i;
    const m = re.exec(d);
    if (!m) return d;
    if (m[1]) {
      cmd = m[1];
      i = re.lastIndex;
      if (cmd === 'z' || cmd === 'Z') segs.push({ c: cmd, a: [] });
      continue;
    }
    if (!cmd || cmd === 'z' || cmd === 'Z') return d;
    // read one full argument group for the current command
    const n = ARGS[cmd.toLowerCase()];
    const a: number[] = [];
    let j = i;
    for (let k = 0; k < n; k++) {
      const isFlag = cmd.toLowerCase() === 'a' && (k === 3 || k === 4);
      const r = isFlag ? flagRe : re;
      r.lastIndex = j;
      const mm = r.exec(d);
      if (!mm || (!isFlag && !mm[2])) return d;
      a.push(Number(isFlag ? mm[1] : mm[2]));
      j = r.lastIndex;
    }
    i = j;
    segs.push({ c: cmd, a });
    if (cmd === 'M') cmd = 'L';
    else if (cmd === 'm') cmd = 'l';
  }
  const f = 10 ** p;
  const rnd = (v: number) => Math.round(v * f) / f;
  // exact and rounded pen positions
  let cx = 0, cy = 0, rx = 0, ry = 0, sx = 0, sy = 0, srx = 0, sry = 0;
  const outSegs: Array<{ c: string; a: number[] }> = [];
  for (const { c, a } of segs) {
    const lc = c.toLowerCase();
    const rel = c === lc;
    if (lc === 'z') {
      cx = sx;
      cy = sy;
      rx = srx;
      ry = sry;
      outSegs.push({ c, a: [] });
      continue;
    }
    const o: number[] = [];
    // which arguments are x / y coordinates (others: radii, angle, flags)
    const kinds: string = lc === 'h' ? 'x' : lc === 'v' ? 'y' : lc === 'a' ? 'nnnffxy' : 'xy'.repeat(a.length / 2);
    let ex = cx, ey = cy, erx = rx, ery = ry;
    a.forEach((v, k) => {
      const kind = kinds[k];
      if (kind === 'x' || kind === 'y') {
        const exact = rel ? (kind === 'x' ? cx : cy) + v : v;
        const base = kind === 'x' ? rx : ry;
        const outV = rel ? rnd(exact - base) : rnd(exact);
        o.push(outV);
        if (kind === 'x') {
          ex = exact;
          erx = rel ? base + outV : outV;
        } else {
          ey = exact;
          ery = rel ? base + outV : outV;
        }
      } else o.push(kind === 'f' ? (v ? 1 : 0) : rnd(v));
    });
    if (lc === 'h') ey = cy, ery = ry;
    if (lc === 'v') ex = cx, erx = rx;
    cx = ex;
    cy = ey;
    rx = rnd(erx);
    ry = rnd(ery);
    if (lc === 'm') {
      sx = cx;
      sy = cy;
      srx = rx;
      sry = ry;
    }
    outSegs.push({ c, a: o });
  }
  let out = '';
  let prevNum = '';
  let last = '';
  for (const { c, a } of outSegs) {
    // the command letter can be left out when it repeats (and for lineto right after moveto)
    const implicit = (c === last && c.toLowerCase() !== 'm') || (last === 'M' && c === 'L') || (last === 'm' && c === 'l');
    if (!implicit || !a.length) {
      out += c;
      prevNum = '';
    }
    last = c;
    for (const v of a) {
      let r = String(v);
      if (r === '-0') r = '0';
      r = r.replace(/^(-?)0\./, '$1.');
      if (prevNum && !r.startsWith('-') && !(r.startsWith('.') && prevNum.includes('.') && !/e/i.test(prevNum))) out += ' ';
      out += r;
      prevNum = r;
    }
  }
  return out;
}

const roundList = (v: string, p: number) => v.trim().replace(NUM_RE, (m) => roundNum(m, p)).replace(/\s*,\s*/g, ',').replace(/\s+/g, ' ');

const isExternal = (url: string) => {
  const u = url.trim();
  if (!u || u.startsWith('#')) return false;
  if (/^data:image\/(png|jpe?g|gif|webp|avif);/i.test(u)) return false;
  return true;
};
const isScriptUrl = (url: string) => /^\s*(javascript|vbscript|data:(?!image\/(png|jpe?g|gif|webp|avif)))/i.test(url.replace(/[\s\u0000-\u001f]+/g, ''));

function cleanCss(css: string, o: SvgOptions, removed: string[]): string {
  let out = css;
  if (/@import/i.test(out)) {
    out = out.replace(/@import[^;]*;?/gi, '');
    removed.push('CSS @import rule');
  }
  if (/expression\s*\(|javascript:|behaviou?r\s*:|-moz-binding/i.test(out)) {
    out = out.replace(/expression\s*\([^)]*\)|javascript:[^;"')]*|behaviou?r\s*:[^;]*;?|-moz-binding\s*:[^;]*;?/gi, '');
    removed.push('script inside CSS');
  }
  if (o.removeExternalRefs) {
    out = out.replace(/url\(\s*(['"]?)([^'")]+)\1\s*\)/gi, (m, _q, url: string) => {
      if (isExternal(url) && !url.startsWith('data:')) {
        removed.push(`external CSS url(${url.slice(0, 60)})`);
        return 'none';
      }
      return m;
    });
  }
  return out;
}

function escAttr(v: string) {
  return v.replace(/&(?!(?:[a-zA-Z][\w.-]*|#\d+|#x[0-9a-fA-F]+);)/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
}

export function optimizeSvg(src: string, opts: Partial<SvgOptions> = {}): SvgResult {
  const o = { ...defaultSvgOptions, ...opts };
  const p = Math.max(0, Math.min(6, Math.round(o.precision)));
  const removed: string[] = [];
  const cleaned = new Set<string>();
  const text = src.replace(/^﻿/, '').replace(/\r\n?/g, '\n');
  if (/<!ENTITY/i.test(text)) removed.push('DOCTYPE entity declarations (can be used for XML bombs)');
  // drop the DOCTYPE before parsing so entity tricks never matter
  const noDoctype = text.replace(/<!DOCTYPE[^[>]*(\[[\s\S]*?\])?\s*>/i, '');
  const tree = toTree(parseXml(noDoctype));
  const rootEl = tree.find(isEl);
  if (!rootEl || rootEl.name.replace(/^.*:/, '').toLowerCase() !== 'svg') throw new Error('The root element is not <svg>.');

  // ---- collect references (for unused id removal)
  const refs = new Set<string>();
  const walkRefs = (n: El['children'][number]) => {
    if (!isEl(n)) {
      for (const m of n.text.matchAll(/#([\w.:-]+)/g)) refs.add(m[1]);
      return;
    }
    for (const [, v] of n.attrs) {
      for (const m of v.matchAll(/url\(\s*['"]?#([^'")\s]+)/g)) refs.add(m[1]);
      if (v.startsWith('#')) refs.add(v.slice(1));
    }
    for (const [k, v] of n.attrs) {
      if (/^(begin|end)$/.test(k)) for (const m of v.matchAll(/([\w-]+)\./g)) refs.add(m[1]);
      if (/^aria-(labelledby|describedby)$/i.test(k)) for (const id of v.split(/\s+/)) refs.add(id);
    }
    n.children.forEach(walkRefs);
  };
  tree.forEach(walkRefs);

  const usedPrefixes = new Set<string>();
  const clean = (el: El, parentName: string): El | El['children'] | null => {
    const lname = el.name.toLowerCase();
    const local = lname.replace(/^.*:/, '');
    if (DANGEROUS_ELEMENTS.has(local)) {
      removed.push(`<${el.name}> element`);
      return null;
    }
    if ((local === 'animate' || local === 'set' || local === 'animatetransform' || local === 'animatemotion') && el.attrs.some(([k, v]) => k === 'attributeName' && /^(xlink:)?href$|^on/i.test(v))) {
      removed.push(`<${el.name}> that changes a link or handler`);
      return null;
    }
    if (o.removeEditorData && (lname.includes(':') && EDITOR_NS.test(lname))) {
      cleaned.add('editor data');
      return null;
    }
    if (o.removeEditorData && local === 'metadata') {
      cleaned.add('<metadata>');
      return null;
    }
    if (o.removeTitleDesc && (local === 'title' || local === 'desc')) {
      cleaned.add('<title>/<desc>');
      return null;
    }
    const attrs: Array<[string, string]> = [];
    for (const [k, rawV] of el.attrs) {
      const lk = k.toLowerCase();
      let v = rawV;
      if (/^on/i.test(lk)) {
        removed.push(`${k}="…" event handler`);
        continue;
      }
      if (lk === 'href' || lk === 'xlink:href' || lk === 'src') {
        if (isScriptUrl(v)) {
          removed.push(`${k}="${v.slice(0, 30)}…" script link`);
          continue;
        }
        if (o.removeExternalRefs && local !== 'a' && isExternal(v)) {
          removed.push(`external reference ${v.slice(0, 60)}`);
          continue;
        }
      }
      if (lk === 'style') {
        v = cleanCss(v, o, removed);
        v = v.replace(/\s*;\s*/g, ';').replace(/\s*:\s*/g, ':').replace(/;$/, '').trim();
        if (!v) continue;
      }
      if (/url\(/i.test(v) && lk !== 'style') v = cleanCss(v, o, removed);
      if (o.removeEditorData && lk.includes(':') && EDITOR_NS.test(lk)) {
        cleaned.add('editor attributes');
        continue;
      }
      if (o.removeEditorData && /^data-name$/.test(lk)) {
        cleaned.add('editor attributes');
        continue;
      }
      if (lk === 'id' && o.removeUnusedIds && !refs.has(v)) {
        cleaned.add('unused ids');
        continue;
      }
      if (local === 'svg' && (lk === 'version' || lk === 'xml:space' || lk === 'enable-background' || lk === 'baseprofile' || (lk === 'x' && v === '0') || (lk === 'y' && v === '0') || lk === 'xmlns:svg')) {
        cleaned.add('redundant <svg> attributes');
        continue;
      }
      if (DEFAULTS[lk] !== undefined && DEFAULTS[lk] === v.trim() && local !== 'svg') {
        cleaned.add('default values');
        continue;
      }
      if (v.trim() === '' && lk !== 'alt' && lk !== 'id') {
        cleaned.add('empty attributes');
        continue;
      }
      if (lk === 'd') {
        const nv = minifyPath(v, p);
        if (nv !== v) cleaned.add('path data');
        v = nv;
      } else if (lk === 'points' || lk === 'viewbox' || lk === 'transform' || lk === 'gradienttransform' || lk === 'patterntransform') {
        // transform factors (scale, matrix) need more digits than coordinates
        v = roundList(v, lk.endsWith('transform') ? Math.max(p + 3, 4) : p);
        if (lk.endsWith('transform')) v = v.replace(/\s*\(\s*/g, '(').replace(/\s*\)\s*/g, ')').replace(/translate\(0(,0)?\)|scale\(1(,1)?\)|rotate\(0\)/g, '').trim();
        if (lk.endsWith('transform') && !v) continue;
      } else if (NUMERIC_ATTRS.has(lk) && /^\s*-?[\d.]+(e[+-]?\d+)?(px)?\s*$/i.test(v)) {
        v = roundNum(v.replace(/px\s*$/i, ''), p);
      }
      const prefix = /^([\w-]+):/.exec(k)?.[1];
      if (prefix && prefix !== 'xmlns' && prefix !== 'xml') usedPrefixes.add(prefix);
      attrs.push([k, v]);
    }
    const ep = /^([\w-]+):/.exec(el.name)?.[1];
    if (ep) usedPrefixes.add(ep);
    const children: El['children'] = [];
    for (const c of el.children) {
      if (!isEl(c)) {
        if (c.raw && c.text.startsWith('<!--')) {
          if (o.removeComments) {
            cleaned.add('comments');
            continue;
          }
          children.push(c);
          continue;
        }
        if (c.raw && c.text.startsWith('<?')) {
          cleaned.add('processing instructions');
          continue;
        }
        if (local === 'style') {
          const css = cleanCss(c.text.replace(/^<!\[CDATA\[|\]\]>$/g, ''), o, removed)
            .replace(/\/\*[\s\S]*?\*\//g, '')
            .replace(/\s+/g, ' ')
            .replace(/\s*([{};:,])\s*/g, '$1')
            .replace(/;}/g, '}')
            .trim();
          if (css) children.push({ text: /[<&]/.test(css) ? `<![CDATA[${css}]]>` : css, raw: true });
          continue;
        }
        children.push(c);
        continue;
      }
      const r = clean(c, local);
      if (r === null) continue;
      if (Array.isArray(r)) children.push(...r);
      else children.push(r);
    }
    // unwrap attribute-less groups; drop empty containers
    if (local === 'g' && attrs.length === 0 && parentName !== 'switch') {
      cleaned.add('empty groups');
      return children;
    }
    if ((local === 'g' || local === 'defs') && !children.some((c) => isEl(c) || c.text.trim())) {
      cleaned.add('empty groups');
      return null;
    }
    return { name: el.name, attrs, children };
  };

  const out = clean(rootEl, '') as El;
  // drop unused namespace declarations
  out.attrs = out.attrs.filter(([k]) => {
    const m = /^xmlns:([\w-]+)$/.exec(k);
    if (m && !usedPrefixes.has(m[1])) {
      cleaned.add('unused namespaces');
      return false;
    }
    return true;
  });
  if (!out.attrs.some(([k]) => k === 'xmlns')) out.attrs.unshift(['xmlns', 'http://www.w3.org/2000/svg']);
  if (usedPrefixes.has('xlink') && !out.attrs.some(([k]) => k === 'xmlns:xlink')) out.attrs.push(['xmlns:xlink', 'http://www.w3.org/1999/xlink']);

  const keepSpace = new Set(['text', 'tspan', 'textpath', 'title', 'desc', 'style']);
  const write = (el: El, depth: number, inText: boolean): string => {
    const local = el.name.toLowerCase().replace(/^.*:/, '');
    const attrs = el.attrs.map(([k, v]) => ` ${k}="${escAttr(v)}"`).join('');
    const textual = inText || keepSpace.has(local);
    const kids = el.children
      .map((c) => {
        if (isEl(c)) return write(c, depth + 1, textual);
        if (c.raw) return c.text;
        if (textual) return c.text.replace(/\s+/g, ' ');
        return c.text.trim() ? c.text.trim() : '';
      })
      .filter((s) => s !== '');
    const pad = o.pretty && !inText ? '\n' + '  '.repeat(depth) : '';
    if (!kids.length) return `${pad}<${el.name}${attrs}/>`;
    const inner = textual ? kids.join('').replace(/^\s+|\s+$/g, (m) => (local === 'tspan' || inText ? m : '')) : kids.join('');
    const close = o.pretty && !textual ? `\n${'  '.repeat(depth)}</${el.name}>` : `</${el.name}>`;
    return `${pad}<${el.name}${attrs}>${inner}${close}`;
  };
  const svg = write(out, 0, false).trim() + '\n';
  const get = (k: string) => out.attrs.find(([a]) => a.toLowerCase() === k)?.[1];
  const enc = new TextEncoder();
  return {
    svg,
    before: enc.encode(src).length,
    after: enc.encode(svg).length,
    removed: [...new Set(removed)],
    cleaned: [...cleaned],
    width: get('width'),
    height: get('height'),
    viewBox: get('viewbox'),
  };
}
