/**
 * Prints the CV preview from an isolated iframe, so the site's layout, theme and
 * backgrounds never leak into the printout ("Save as PDF" in the print dialog
 * gives a text-based PDF that works with every script and font).
 */
import type { CvStyle } from './cv-pdf';

const CSS = `
*{box-sizing:border-box}
html,body{margin:0;background:#fff}
.cv-paper{--cv-base:10.4pt;color:#1b1b1f;font-size:var(--cv-base);line-height:1.38;font-family:Georgia,'Times New Roman',Times,serif;overflow-wrap:anywhere}
.cv-paper.cv-sans{font-family:'Helvetica Neue',Helvetica,Arial,'Segoe UI',sans-serif}
.cv-paper.cv-compact{--cv-base:9.6pt;line-height:1.3}
.cv-paper a{color:inherit;text-decoration:none}
.cv-head{margin-bottom:.9em}
.cv-center .cv-head{text-align:center}
.cv-head h1{margin:0;font-size:2.15em;line-height:1.1;letter-spacing:.01em;color:#111}
.cv-label{margin:.2em 0 0;font-size:1.15em;color:#505058}
.cv-contacts{margin:.35em 0 0;font-size:.9em;color:#4a4a52}
.cv-contacts span+span::before{content:' | ';color:#9a9aa2}
.cv-sec{margin-top:.9em}
.cv-sec h2{margin:0 0 .45em;padding-bottom:.15em;border-bottom:.7pt solid var(--cv-accent);color:var(--cv-accent);font-size:1.07em;text-transform:uppercase;letter-spacing:.06em;font-weight:700;break-after:avoid}
.cv-sec p{margin:.15em 0}
.cv-sec ul{margin:.2em 0 .1em;padding-left:1.4em}
.cv-sec li{margin:.08em 0}
.cv-entry{margin-bottom:.55em;break-inside:avoid}
.cv-row{display:flex;justify-content:space-between;gap:1em}
.cv-row>span,.cv-sub>em:last-child{flex:none;color:#55555d;text-align:right}
.cv-sub{color:#33333a}
.cv-skill{margin:.12em 0}
`;

export function printCvPreview(style: CvStyle): boolean {
  const paper = document.querySelector<HTMLElement>('.cv-paper');
  if (!paper) return false;
  const frame = document.createElement('iframe');
  frame.setAttribute('aria-hidden', 'true');
  frame.tabIndex = -1;
  Object.assign(frame.style, { position: 'fixed', right: '0', bottom: '0', width: '0', height: '0', border: '0', opacity: '0' });
  document.body.appendChild(frame);
  const doc = frame.contentDocument;
  const win = frame.contentWindow;
  if (!doc || !win) {
    frame.remove();
    return false;
  }
  const margin = style.density === 'compact' ? '12mm 13mm' : '15mm 16mm';
  const title = paper.querySelector('h1')?.textContent?.trim() || 'CV';
  doc.open();
  doc.write(`<!doctype html><html><head><meta charset="utf-8"><title>${title.replace(/[<>&]/g, '')}</title><style>@page{size:${style.paper === 'a4' ? 'A4' : 'letter'};margin:${margin}}${CSS}</style></head><body></body></html>`);
  doc.close();
  const clone = paper.cloneNode(true) as HTMLElement;
  clone.style.setProperty('--cv-accent', style.accent);
  doc.body.appendChild(doc.importNode(clone, true));
  const cleanup = () => setTimeout(() => frame.remove(), 1000);
  win.addEventListener('afterprint', cleanup, { once: true });
  setTimeout(() => {
    win.focus();
    win.print();
    // Some browsers do not fire afterprint for iframes; remove it later anyway.
    setTimeout(() => frame.remove(), 60_000);
  }, 50);
  return true;
}

const esc = (s: string) => s.replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' })[c]!);

/** Prints plain text (e.g. a cover letter) as a clean, single-column document. */
export function printPlainText(title: string, text: string, paper: 'a4' | 'letter' = 'a4'): boolean {
  const frame = document.createElement('iframe');
  frame.setAttribute('aria-hidden', 'true');
  frame.tabIndex = -1;
  Object.assign(frame.style, { position: 'fixed', right: '0', bottom: '0', width: '0', height: '0', border: '0', opacity: '0' });
  document.body.appendChild(frame);
  const doc = frame.contentDocument;
  const win = frame.contentWindow;
  if (!doc || !win) {
    frame.remove();
    return false;
  }
  const body = text
    .split(/\n{2,}/)
    .map((p) => `<p>${esc(p).replace(/\n/g, '<br>')}</p>`)
    .join('');
  doc.open();
  doc.write(`<!doctype html><html><head><meta charset="utf-8"><title>${esc(title)}</title><style>@page{size:${paper === 'a4' ? 'A4' : 'letter'};margin:22mm 22mm}body{margin:0;font:11.5pt/1.5 Georgia,'Times New Roman',serif;color:#1b1b1f}p{margin:0 0 1em}</style></head><body>${body}</body></html>`);
  doc.close();
  setTimeout(() => {
    win.focus();
    win.print();
    setTimeout(() => frame.remove(), 60_000);
  }, 50);
  return true;
}
