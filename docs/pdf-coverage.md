# PDF feature coverage

Compared with the [iLovePDF tool catalog](https://www.ilovepdf.com/user/premium) and the editing screenshots supplied for this project. This is an implementation inventory, not a claim of equivalent output quality on every PDF.

| iLovePDF group | Available in UsamaVerse | Still missing or limited |
|---|---|---|
| Organize | Merge, split, remove/extract pages, reorder/rotate, organize thumbnails, scan photos to PDF | Cross-device scanning handoff; advanced batch workflows |
| Optimize | Compress, repair, English OCR | OCR languages beyond English; specialized optimization profiles |
| Convert to PDF | JPG/PNG images, DOCX, PPTX, XLSX and local HTML to PDF | Office/HTML pages rendered from DOCX/PPTX/HTML are images, so text is not selectable. Excel is a simplified printable table. Remote web pages and older DOC/PPT/XLS formats are unsupported. |
| Convert from PDF | PDF pages to JPG/PNG, extract embedded images, text/Markdown, DOCX, PPTX, XLSX, and image-based PDF/A-2b | DOCX and XLSX contain editable extracted text with approximate layout; PPTX preserves appearance as slide images, not editable elements. PDF/A loses text and interactive content. |
| Edit | Direct editing of supported existing text objects (with size/color), added text/images/shapes/ink, page numbers, watermark, crop, rotate, form filling | Editing text drawn as paths or inside scans; changing existing font family; text reflow; creating new form fields |
| Security | Open-password protect/unlock, visual signature, raster redaction, visual/text comparison | Certificate-based signatures and identity workflow; advanced permission controls |
| Intelligence | Best-effort text/Markdown extraction | Browser-local AI summarization and translation |

The PDF editor uses PDFium to rewrite a selected text object in the content stream. It keeps the page as PDF rather than rendering it to a picture. Tests cover text replacement, font size/color, an untouched text object, and a form field. PDFs are not word-processing files: a paragraph may be many glyph objects, and fonts can have limited glyph sets. The editor rejects unsupported rotations and objects it cannot target. OCR can add a searchable layer to scans, but it cannot change the visible pixels of scanned words.

The conversion workspace performs all ten conversions in the supplied iLovePDF menu locally. Browser tests open every produced file; the PDF/A-2b sample was additionally validated with veraPDF 1.30.3 (`PASS`, 2b profile). These are format conversions, not a guarantee of iLovePDF-level fidelity or editable reconstruction. Word and PowerPoint rendering depends on browser font availability; Excel print layout is intentionally simplified. Local HTML is sandboxed, with scripts and external resources removed. Users should inspect output before sharing it and independently validate PDF/A files for regulated archiving.

The remaining AI features and full Office layout reconstruction need dedicated browser engines and test corpora. Do not expose a route, search result or count for one until it produces and validates a real file. See `lib/tools/registry.planned.ts` for implementation candidates.
