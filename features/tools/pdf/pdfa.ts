/** Visual PDF/A-2b conversion: re-render pages, then write only RGB images. */
import { PDFDocument, PDFHexString, PDFName, PDFString } from 'pdf-lib';
import { openPdf, renderPage, releaseCanvas } from './pdfjs';

const MAX_PAGES = 100;

export async function convertToPdfA(bytes: Uint8Array, progress: (message: string) => void): Promise<Blob> {
  const source = await openPdf(bytes);
  try {
    if (source.numPages > MAX_PAGES) throw new Error(`PDF/A conversion is limited to ${MAX_PAGES} pages per file.`);
    const profileResponse = await fetch('/pdfa/sRGB.icc');
    if (!profileResponse.ok) throw new Error('The bundled sRGB profile could not be loaded.');
    const profile = new Uint8Array(await profileResponse.arrayBuffer());
    const pdf = await PDFDocument.create();
    const now = new Date();
    pdf.setTitle('Archived PDF copy');
    pdf.setCreator('UsamaVerse');
    pdf.setProducer('UsamaVerse');
    pdf.setCreationDate(now);
    pdf.setModificationDate(now);
    for (let p = 1; p <= source.numPages; p++) {
      progress(`Archiving page ${p} of ${source.numPages}…`);
      const sourcePage = await source.getPage(p);
      const viewport = sourcePage.getViewport({ scale: 1 });
      const canvas = await renderPage(source, p, 1.5);
      const blob = await new Promise<Blob>((resolve, reject) => canvas.toBlob((value) => value ? resolve(value) : reject(new Error('Could not encode page image.')), 'image/jpeg', 0.92));
      const image = await pdf.embedJpg(new Uint8Array(await blob.arrayBuffer()));
      const page = pdf.addPage([viewport.width, viewport.height]);
      page.drawImage(image, { x: 0, y: 0, width: viewport.width, height: viewport.height });
      releaseCanvas(canvas);
    }
    const profileStream = pdf.context.stream(profile, { N: 3 });
    const outputIntent = pdf.context.obj({
      Type: PDFName.of('OutputIntent'),
      S: PDFName.of('GTS_PDFA1'),
      OutputConditionIdentifier: PDFString.of('sRGB IEC61966-2.1'),
      Info: PDFString.of('sRGB IEC61966-2.1'),
      DestOutputProfile: pdf.context.register(profileStream),
    });
    pdf.catalog.set(PDFName.of('OutputIntents'), pdf.context.obj([pdf.context.register(outputIntent)]));
    const id = PDFHexString.of(Array.from(crypto.getRandomValues(new Uint8Array(16)), (b) => b.toString(16).padStart(2, '0')).join(''));
    pdf.context.trailerInfo.ID = pdf.context.obj([id, id]);
    const date = now.toISOString();
    const xmp = `<?xpacket begin="\uFEFF" id="W5M0MpCehiHzreSzNTczkc9d"?>
<x:xmpmeta xmlns:x="adobe:ns:meta/"><rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#">
<rdf:Description rdf:about="" xmlns:dc="http://purl.org/dc/elements/1.1/"><dc:format>application/pdf</dc:format><dc:title><rdf:Alt><rdf:li xml:lang="x-default">Archived PDF copy</rdf:li></rdf:Alt></dc:title></rdf:Description>
<rdf:Description rdf:about="" xmlns:xmp="http://ns.adobe.com/xap/1.0/"><xmp:CreatorTool>UsamaVerse</xmp:CreatorTool><xmp:CreateDate>${date}</xmp:CreateDate><xmp:ModifyDate>${date}</xmp:ModifyDate><xmp:MetadataDate>${date}</xmp:MetadataDate></rdf:Description>
<rdf:Description rdf:about="" xmlns:pdf="http://ns.adobe.com/pdf/1.3/"><pdf:Producer>UsamaVerse</pdf:Producer></rdf:Description>
<rdf:Description rdf:about="" xmlns:pdfaid="http://www.aiim.org/pdfa/ns/id/"><pdfaid:part>2</pdfaid:part><pdfaid:conformance>B</pdfaid:conformance></rdf:Description>
</rdf:RDF></x:xmpmeta><?xpacket end="w"?>`;
    const metadata = pdf.context.stream(new TextEncoder().encode(xmp), { Type: PDFName.of('Metadata'), Subtype: PDFName.of('XML') });
    pdf.catalog.set(PDFName.of('Metadata'), pdf.context.register(metadata));
    const output = await pdf.save({ useObjectStreams: false });
    return new Blob([output as BlobPart], { type: 'application/pdf' });
  } finally { await source.loadingTask.destroy(); }
}
