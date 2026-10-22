/**
 * Prints a self-contained HTML fragment from a hidden iframe, so the site's own
 * layout, theme and backgrounds never end up on paper.
 */
export function printHtml(bodyHtml: string, css: string, title: string, paper: 'a4' | 'letter' = 'a4', margin = '16mm'): boolean {
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
  const safeTitle = title.replace(/[<>&]/g, '');
  doc.open();
  doc.write(`<!doctype html><html><head><meta charset="utf-8"><title>${safeTitle}</title><style>@page{size:${paper === 'a4' ? 'A4' : 'letter'};margin:${margin}}html,body{margin:0;background:#fff}${css}</style></head><body>${bodyHtml}</body></html>`);
  doc.close();
  setTimeout(() => {
    win.focus();
    win.print();
    setTimeout(() => frame.remove(), 60_000);
  }, 50);
  return true;
}
