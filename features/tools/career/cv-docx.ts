/** CV → Word (.docx) using the docx library, in the browser. */
import { cleanCv, contactItems, dateRange, type CvData } from './cv-model';
import type { CvStyle } from './cv-pdf';

const PAGE = { a4: { width: 11906, height: 16838 }, letter: { width: 12240, height: 15840 } };

export async function cvToDocx(input: CvData, style: CvStyle): Promise<Blob> {
  const d = await import('docx');
  const { Document, Packer, Paragraph, TextRun, AlignmentType, TabStopType, BorderStyle, ExternalHyperlink, LevelFormat } = d;
  const cv = cleanCv(input);
  const b = cv.basics;
  const compact = style.density === 'compact';
  const margin = compact ? 850 : 1050;
  const page = PAGE[style.paper];
  const contentWidth = page.width - 2 * margin;
  const accent = style.accent.replace('#', '').toUpperCase();
  const font = style.font === 'serif' ? 'Georgia' : 'Calibri';
  const size = compact ? 19 : 21; // half-points
  const align = style.align === 'center' ? AlignmentType.CENTER : AlignmentType.LEFT;
  const children: InstanceType<typeof Paragraph>[] = [];
  const tight = { after: compact ? 20 : 40 };

  children.push(new Paragraph({ alignment: align, spacing: { after: 40 }, children: [new TextRun({ text: b.name || 'Your Name', bold: true, size: compact ? 40 : 46 })] }));
  if (b.label.trim()) children.push(new Paragraph({ alignment: align, spacing: { after: 40 }, children: [new TextRun({ text: b.label.trim(), color: '555555', size: size + 3 })] }));
  const contacts = contactItems(b);
  if (contacts.length) {
    const runs: Array<InstanceType<typeof TextRun> | InstanceType<typeof ExternalHyperlink>> = [];
    contacts.forEach((c, i) => {
      if (i) runs.push(new TextRun({ text: '  |  ', color: '777777', size: size - 2 }));
      if (c.href) runs.push(new ExternalHyperlink({ link: c.href, children: [new TextRun({ text: c.text, color: '444444', size: size - 2 })] }));
      else runs.push(new TextRun({ text: c.text, color: '444444', size: size - 2 }));
    });
    children.push(new Paragraph({ alignment: align, spacing: { after: 120 }, children: runs }));
  }

  const heading = (text: string) =>
    children.push(
      new Paragraph({
        spacing: { before: compact ? 140 : 200, after: 80 },
        keepNext: true,
        border: { bottom: { color: accent, space: 1, style: BorderStyle.SINGLE, size: 6 } },
        children: [new TextRun({ text: text.toUpperCase(), bold: true, color: accent, size: size + 2 })],
      }),
    );
  const bullet = (text: string) => children.push(new Paragraph({ numbering: { reference: 'cv-bullets', level: 0 }, spacing: { after: 10 }, children: [new TextRun({ text })] }));
  const tabbed = (left: InstanceType<typeof TextRun>, right: string, italics = false) =>
    new Paragraph({
      keepNext: true,
      spacing: tight,
      tabStops: [{ type: TabStopType.RIGHT, position: contentWidth }],
      children: [left, ...(right ? [new TextRun({ text: `\t${right}`, italics, color: '555555' })] : [])],
    });

  if (b.summary.trim()) {
    heading('Summary');
    children.push(new Paragraph({ spacing: tight, children: [new TextRun({ text: b.summary.trim() })] }));
  }
  for (const s of cv.sections) {
    heading(s.heading);
    if (s.kind === 'text') for (const p of s.text.split(/\n{2,}/)) children.push(new Paragraph({ spacing: tight, children: [new TextRun({ text: p })] }));
    if (s.kind === 'list') s.items.forEach(bullet);
    if (s.kind === 'skills')
      for (const g of s.skills)
        children.push(new Paragraph({ spacing: tight, children: [...(g.name.trim() ? [new TextRun({ text: `${g.name.trim()}: `, bold: true })] : []), new TextRun({ text: g.items.trim() })] }));
    if (s.kind === 'entries')
      for (const e of s.entries) {
        children.push(tabbed(new TextRun({ text: e.title.trim() || e.org.trim(), bold: true }), dateRange(e)));
        if ((e.title.trim() && e.org.trim()) || e.location.trim()) children.push(tabbed(new TextRun({ text: e.title.trim() ? e.org.trim() : '', italics: true }), e.location.trim(), true));
        if (e.details.trim()) children.push(new Paragraph({ spacing: tight, children: [new TextRun({ text: e.details.trim() })] }));
        if (e.url.trim()) {
          const href = /^https?:/i.test(e.url) ? e.url : `https://${e.url}`;
          children.push(new Paragraph({ spacing: tight, children: [new ExternalHyperlink({ link: href, children: [new TextRun({ text: e.url.replace(/^https?:\/\//, ''), color: accent })] })] }));
        }
        e.bullets.forEach(bullet);
        children.push(new Paragraph({ spacing: { after: compact ? 40 : 80 }, children: [] }));
      }
  }

  const doc = new Document({
    creator: b.name || 'UsamaVerse',
    title: b.name ? `${b.name} — CV` : 'CV',
    description: 'Created with the UsamaVerse CV Builder',
    styles: { default: { document: { run: { font, size } } } },
    numbering: {
      config: [
        {
          reference: 'cv-bullets',
          levels: [{ level: 0, format: LevelFormat.BULLET, text: '•', alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: 360, hanging: 240 } } } }],
        },
      ],
    },
    sections: [{ properties: { page: { size: page, margin: { top: margin, bottom: margin, left: margin, right: margin } } }, children }],
  });
  return Packer.toBlob(doc);
}

/** Plain text (paragraphs separated by blank lines) → .docx. */
export async function textToDocx(text: string, title = 'Document'): Promise<Blob> {
  const { Document, Packer, Paragraph, TextRun } = await import('docx');
  const paras = text.replace(/\r\n?/g, '\n').split('\n');
  const children = paras.map((line) => new Paragraph({ spacing: { after: line.trim() ? 0 : 120 }, children: [new TextRun({ text: line })] }));
  const doc = new Document({
    title,
    creator: 'UsamaVerse',
    styles: { default: { document: { run: { font: 'Georgia', size: 22 } } } },
    sections: [{ properties: { page: { margin: { top: 1250, bottom: 1250, left: 1250, right: 1250 } } }, children }],
  });
  return Packer.toBlob(doc);
}
