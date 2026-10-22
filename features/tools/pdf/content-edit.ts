/** Browser-local PDFium editing of existing text objects. No page rasterization. */
import type { WrappedPdfiumModule } from '@embedpdf/pdfium';

type Point = { x: number; y: number };
export type EditableText = {
  page: number;
  objectIndex: number;
  original: string;
  box: { x: number; y: number; width: number; height: number };
  fontSize: number;
  color: string;
};
export type TextChange = EditableText & { text: string };
export type PdfImagePixels = { page: number; ordinal: number; width: number; height: number; rgba: Uint8ClampedArray };

type Runtime = WrappedPdfiumModule & { pdfium: WrappedPdfiumModule['pdfium'] & { wasmExports: { memory: WebAssembly.Memory; malloc(size: number): number; free(ptr: number): void } } };
let runtimePromise: Promise<Runtime> | null = null;

async function pdfium(): Promise<Runtime> {
  if (!runtimePromise) runtimePromise = (async () => {
    const { init } = await import('@embedpdf/pdfium');
    const response = await fetch('/pdfium/pdfium.wasm');
    if (!response.ok) throw new Error('The local PDF editing engine could not be loaded.');
    const engine = await init({ wasmBinary: await response.arrayBuffer() }) as Runtime;
    engine.PDFiumExt_Init();
    return engine;
  })().catch((error) => { runtimePromise = null; throw error; });
  return runtimePromise;
}

function memory(p: Runtime): Uint8Array { return new Uint8Array(p.pdfium.wasmExports.memory.buffer); }
function allocate(p: Runtime, size: number): number {
  const ptr = p.pdfium.wasmExports.malloc(Math.max(1, size));
  if (!ptr) throw new Error('Not enough memory to edit this PDF.');
  return ptr;
}

async function withDocument<T>(bytes: Uint8Array, action: (p: Runtime, doc: number) => T): Promise<T> {
  const p = await pdfium();
  const ptr = allocate(p, bytes.length);
  try {
    memory(p).set(bytes, ptr);
    const doc = p.FPDF_LoadMemDocument(ptr, bytes.length, '');
    if (!doc) throw new Error('This PDF cannot be opened for content editing. Encrypted files require a password.');
    try { return action(p, doc); }
    finally { p.FPDF_CloseDocument(doc); }
  } finally { p.pdfium.wasmExports.free(ptr); }
}

function objectText(p: Runtime, object: number, textPage: number): string {
  const length = p.FPDFTextObj_GetText(object, textPage, 0, 0);
  if (length < 2 || length > 1024 * 1024) return '';
  const ptr = allocate(p, length);
  try {
    p.FPDFTextObj_GetText(object, textPage, ptr, length);
    return p.pdfium.UTF16ToString(ptr);
  } finally { p.pdfium.wasmExports.free(ptr); }
}

function objectBounds(p: Runtime, object: number): [number, number, number, number] | null {
  const ptr = allocate(p, 16);
  try {
    if (!p.FPDFPageObj_GetBounds(object, ptr, ptr + 4, ptr + 8, ptr + 12)) return null;
    const values = [0, 4, 8, 12].map((offset) => p.pdfium.getValue(ptr + offset, 'float')) as [number, number, number, number];
    if (!values.every(Number.isFinite) || values[2] <= values[0] || values[3] <= values[1]) return null;
    return values;
  } finally { p.pdfium.wasmExports.free(ptr); }
}

function objectStyle(p: Runtime, object: number): { fontSize: number; color: string } | null {
  const ptr = allocate(p, 24);
  try {
    if (!p.FPDFTextObj_GetFontSize(object, ptr)) return null;
    const rawSize = p.pdfium.getValue(ptr, 'float');
    if (!p.FPDFPageObj_GetMatrix(object, ptr)) return null;
    const c = p.pdfium.getValue(ptr + 8, 'float');
    const d = p.pdfium.getValue(ptr + 12, 'float');
    const fontSize = rawSize * Math.hypot(c, d);
    if (!(fontSize >= 1 && fontSize <= 500)) return null;
    if (!p.FPDFPageObj_GetFillColor(object, ptr, ptr + 4, ptr + 8, ptr + 12)) return null;
    const color = [0, 4, 8].map((offset) => p.pdfium.getValue(ptr + offset, 'i32').toString(16).padStart(2, '0')).join('');
    return { fontSize, color: `#${color}` };
  } finally { p.pdfium.wasmExports.free(ptr); }
}

function updateStyle(p: Runtime, object: number, target: TextChange) {
  if (!/^#[0-9a-fA-F]{6}$/.test(target.color)) throw new Error('Choose a valid text color.');
  if (!(target.fontSize >= 4 && target.fontSize <= 144)) throw new Error('Text size must be between 4 and 144 points.');
  const channels = [1, 3, 5].map((start) => parseInt(target.color.slice(start, start + 2), 16));
  if (!p.FPDFPageObj_SetFillColor(object, channels[0], channels[1], channels[2], 255)) throw new Error('The text color could not be changed.');
  const ptr = allocate(p, 24);
  try {
    if (!p.FPDFTextObj_GetFontSize(object, ptr)) throw new Error('The text size could not be read.');
    const rawSize = p.pdfium.getValue(ptr, 'float');
    if (!p.FPDFPageObj_GetMatrix(object, ptr)) throw new Error('The text transform could not be read.');
    const currentSize = rawSize * Math.hypot(p.pdfium.getValue(ptr + 8, 'float'), p.pdfium.getValue(ptr + 12, 'float'));
    const ratio = target.fontSize / currentSize;
    if (!Number.isFinite(ratio) || ratio <= 0) throw new Error('The text size could not be changed.');
    for (const offset of [0, 4, 8, 12]) p.pdfium.setValue(ptr + offset, p.pdfium.getValue(ptr + offset, 'float') * ratio, 'float');
    if (!p.FPDFPageObj_SetMatrix(object, ptr)) throw new Error('The text size could not be changed.');
  } finally { p.pdfium.wasmExports.free(ptr); }
}

function saveDocument(p: Runtime, doc: number): Uint8Array {
  const writer = p.PDFiumExt_OpenFileWriter();
  if (!writer) throw new Error('The PDF writer could not start.');
  try {
    if (!p.PDFiumExt_SaveAsCopy(doc, writer)) throw new Error('The PDF could not be saved.');
    const size = p.PDFiumExt_GetFileWriterSize(writer);
    if (size < 8) throw new Error('The PDF writer produced no document.');
    const ptr = allocate(p, size);
    try {
      if (p.PDFiumExt_GetFileWriterData(writer, ptr, size) !== size) throw new Error('The PDF could not be copied.');
      return memory(p).slice(ptr, ptr + size);
    } finally { p.pdfium.wasmExports.free(ptr); }
  } finally { p.PDFiumExt_CloseFileWriter(writer); }
}

/** Hit-tests real PDF text objects. Visual coordinates are PDF points, origin bottom left. */
export async function locateEditableText(bytes: Uint8Array, pageIndex: number, point: Point): Promise<EditableText | null> {
  return withDocument(bytes, (p, doc) => {
    const page = p.FPDF_LoadPage(doc, pageIndex);
    if (!page) throw new Error(`Page ${pageIndex + 1} could not be opened.`);
    try {
      if (p.FPDFPage_GetRotation(page) !== 0) throw new Error('Direct text editing is not yet available on rotated PDF pages.');
      const textPage = p.FPDFText_LoadPage(page);
      if (!textPage) throw new Error('The text layer could not be read.');
      try {
        let found: { item: EditableText; area: number } | null = null;
        for (let i = 0, count = p.FPDFPage_CountObjects(page); i < count; i++) {
          const object = p.FPDFPage_GetObject(page, i);
          if (p.FPDFPageObj_GetType(object) !== 1) continue;
          const bounds = objectBounds(p, object);
          if (!bounds) continue;
          const [left, bottom, right, top] = bounds;
          if (point.x < left - 3 || point.x > right + 3 || point.y < bottom - 3 || point.y > top + 3) continue;
          const original = objectText(p, object, textPage);
          if (!original.trim()) continue;
          const style = objectStyle(p, object);
          if (!style) continue;
          const area = (right - left) * (top - bottom);
          if (!found || area < found.area) found = {
            item: { page: pageIndex, objectIndex: i, original, box: { x: left, y: bottom, width: right - left, height: top - bottom }, ...style }, area,
          };
        }
        return found?.item ?? null;
      } finally { p.FPDFText_ClosePage(textPage); }
    } finally { p.FPDF_ClosePage(page); }
  });
}

/** Rewrites text objects while retaining the other page objects, links and forms. */
export async function editExistingText(bytes: Uint8Array, changes: TextChange[]): Promise<Uint8Array> {
  if (!changes.length) return bytes;
  const result = await withDocument(bytes, (p, doc) => {
    const byPage = new Map<number, TextChange[]>();
    for (const change of changes) byPage.set(change.page, [...(byPage.get(change.page) ?? []), change]);
    for (const [pageIndex, edits] of byPage) {
      const page = p.FPDF_LoadPage(doc, pageIndex);
      if (!page) throw new Error(`Page ${pageIndex + 1} could not be opened.`);
      try {
        const textPage = p.FPDFText_LoadPage(page);
        if (!textPage) throw new Error(`Page ${pageIndex + 1} has no editable text layer.`);
        try {
          for (const edit of edits) {
            const object = p.FPDFPage_GetObject(page, edit.objectIndex);
            if (!object || p.FPDFPageObj_GetType(object) !== 1 || objectText(p, object, textPage) !== edit.original) {
              throw new Error('The selected text changed or could not be matched. Reload the PDF and select it again.');
            }
            if (edit.text.includes('\n') || edit.text.includes('\r')) throw new Error('An existing text object must be replaced with one line of text. Add a new text box for multiple lines.');
            const length = (edit.text.length + 1) * 2;
            const ptr = allocate(p, length);
            try {
              p.pdfium.stringToUTF16(edit.text, ptr, length);
              if (!p.FPDFText_SetText(object, ptr)) throw new Error('This embedded font could not encode the new text. Try a different character or add a new text box.');
            } finally { p.pdfium.wasmExports.free(ptr); }
            updateStyle(p, object, edit);
          }
        } finally { p.FPDFText_ClosePage(textPage); }
        if (!p.FPDFPage_GenerateContent(page)) throw new Error(`Page ${pageIndex + 1} could not be regenerated.`);
      } finally { p.FPDF_ClosePage(page); }
    }
    return saveDocument(p, doc);
  });
  await withDocument(result, (p, doc) => {
    for (const change of changes) {
      const page = p.FPDF_LoadPage(doc, change.page);
      if (!page) throw new Error('The edited page could not be reopened for verification.');
      try {
        const textPage = p.FPDFText_LoadPage(page);
        if (!textPage) throw new Error('The edited text could not be verified.');
        try {
          const object = p.FPDFPage_GetObject(page, change.objectIndex);
          if (!object || objectText(p, object, textPage) !== change.text) {
            throw new Error('The original font cannot display some replacement characters. Try text supported by that font or add a new text box.');
          }
        } finally { p.FPDFText_ClosePage(textPage); }
      } finally { p.FPDF_ClosePage(page); }
    }
  });
  return result;
}

/** Applies an open password locally, with a separate random owner password. */
export async function protectPdf(bytes: Uint8Array, password: string): Promise<Uint8Array> {
  if (password.length < 4 || new TextEncoder().encode(password).length > 127) throw new Error('Use a password of at least 4 characters and no more than 127 UTF-8 bytes.');
  if (!globalThis.crypto?.getRandomValues) throw new Error('Secure random numbers are unavailable in this browser.');
  const random = crypto.getRandomValues(new Uint8Array(24));
  const owner = Array.from(random, (n) => n.toString(16).padStart(2, '0')).join('');
  return withDocument(bytes, (p, doc) => {
    if (p.EPDF_IsEncrypted(doc)) throw new Error('This PDF is already encrypted. Unlock it first.');
    if (!p.EPDF_SetEncryption(doc, password, owner, -4)) throw new Error('This PDF could not be password protected.');
    return saveDocument(p, doc);
  });
}

/** Opens a password-protected PDF and writes an unencrypted copy. */
export async function unlockPdf(bytes: Uint8Array, password: string): Promise<Uint8Array> {
  if (!password) throw new Error('Enter the PDF password.');
  const p = await pdfium();
  const ptr = allocate(p, bytes.length);
  try {
    memory(p).set(bytes, ptr);
    const doc = p.FPDF_LoadMemDocument(ptr, bytes.length, password);
    if (!doc) throw new Error('The password is wrong, or this PDF cannot be opened.');
    try {
      if (!p.EPDF_IsEncrypted(doc)) throw new Error('This PDF has no open password.');
      if (!p.EPDF_RemoveEncryption(doc)) throw new Error('The PDF encryption could not be removed.');
      return saveDocument(p, doc);
    } finally { p.FPDF_CloseDocument(doc); }
  } finally { p.pdfium.wasmExports.free(ptr); }
}

/** Extracts embedded image page objects at their native pixel size. */
export async function extractPdfImagePixels(bytes: Uint8Array): Promise<PdfImagePixels[]> {
  return withDocument(bytes, (p, doc) => {
    const results: PdfImagePixels[] = [];
    let totalPixels = 0;
    const visit = (container: number, pageIndex: number, depth: number) => {
      if (depth > 6) return;
      const count = depth ? p.FPDFFormObj_CountObjects(container) : p.FPDFPage_CountObjects(container);
      for (let i = 0; i < count; i++) {
        const object = depth ? p.FPDFFormObj_GetObject(container, i) : p.FPDFPage_GetObject(container, i);
        const kind = p.FPDFPageObj_GetType(object);
        if (kind === 5) { visit(object, pageIndex, depth + 1); continue; }
        if (kind !== 3) continue;
        const dimensions = allocate(p, 8);
        let nativePixels = 0;
        try {
          if (p.FPDFImageObj_GetImagePixelSize(object, dimensions, dimensions + 4)) {
            nativePixels = p.pdfium.getValue(dimensions, 'i32') * p.pdfium.getValue(dimensions + 4, 'i32');
          }
        } finally { p.pdfium.wasmExports.free(dimensions); }
        if (nativePixels > 40_000_000) continue;
        if (totalPixels + nativePixels > 80_000_000) throw new Error('Embedded images exceed the 80 megapixel in-browser limit.');
        const bitmap = p.FPDFImageObj_GetBitmap(object);
        if (!bitmap) continue;
        try {
          const width = p.FPDFBitmap_GetWidth(bitmap);
          const height = p.FPDFBitmap_GetHeight(bitmap);
          const stride = p.FPDFBitmap_GetStride(bitmap);
          const format = p.FPDFBitmap_GetFormat(bitmap);
          const buffer = p.FPDFBitmap_GetBuffer(bitmap);
          if (!(width > 0 && height > 0 && width * height <= 40_000_000 && stride >= width * (format === 1 ? 1 : format === 2 ? 3 : 4) && buffer)) continue;
          totalPixels += width * height;
          if (totalPixels > 80_000_000) throw new Error('Embedded images exceed the 80 megapixel in-browser limit.');
          const source = memory(p).slice(buffer, buffer + stride * height);
          const rgba = new Uint8ClampedArray(width * height * 4);
          for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
            const dst = (y * width + x) * 4;
            if (format === 1) {
              const gray = source[y * stride + x];
              rgba[dst] = rgba[dst + 1] = rgba[dst + 2] = gray; rgba[dst + 3] = 255;
            } else if (format >= 2 && format <= 4) {
              const src = y * stride + x * (format === 2 ? 3 : 4);
              rgba[dst] = source[src + 2]; rgba[dst + 1] = source[src + 1]; rgba[dst + 2] = source[src];
              rgba[dst + 3] = format === 4 ? source[src + 3] : 255;
            }
          }
          if (format >= 1 && format <= 4) results.push({ page: pageIndex + 1, ordinal: results.filter((item) => item.page === pageIndex + 1).length + 1, width, height, rgba });
        } finally { p.FPDFBitmap_Destroy(bitmap); }
      }
    };
    for (let index = 0, count = p.FPDF_GetPageCount(doc); index < count; index++) {
      const page = p.FPDF_LoadPage(doc, index);
      if (!page) continue;
      try { visit(page, index, 0); }
      finally { p.FPDF_ClosePage(page); }
    }
    return results;
  });
}
