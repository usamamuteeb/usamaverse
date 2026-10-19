'use client';

import { useEffect, useRef, useState } from 'react';
import { Status } from '@/components/tool-kit/fields';
import { FileDrop } from '@/components/tool-kit/files';
import { formatBytes } from '@/lib/format';
import { detectSignature } from '@/features/tools/files/logic';
import { MAX_IMAGE_BYTES, MAX_PIXELS } from './logic';

export interface LoadedImage {
  file: File;
  mime: string;
  url: string;
  bitmap: ImageBitmap;
  width: number;
  height: number;
}

const RASTER = ['image/png', 'image/jpeg', 'image/webp', 'image/gif', 'image/bmp', 'image/avif'];

/** Validated image picker (signature check, size limits, EXIF orientation applied). Frees memory on change/unmount. */
export function useImageFile(accept = 'image/png,image/jpeg,image/webp,image/gif,image/bmp,image/avif') {
  const [img, setImg] = useState<LoadedImage | null>(null);
  const [error, setError] = useState<string | null>(null);
  const ref = useRef<LoadedImage | null>(null);
  const release = (x: LoadedImage | null) => {
    if (!x) return;
    URL.revokeObjectURL(x.url);
    x.bitmap.close();
  };
  useEffect(() => () => release(ref.current), []);
  const set = (x: LoadedImage | null) => {
    release(ref.current);
    ref.current = x;
    setImg(x);
  };
  const load = async (file: File) => {
    setError(null);
    if (file.size > MAX_IMAGE_BYTES) return setError(`This file is ${formatBytes(file.size)}; the limit is ${formatBytes(MAX_IMAGE_BYTES)}.`);
    const sig = detectSignature(new Uint8Array(await file.slice(0, 32).arrayBuffer()));
    if (!sig || !RASTER.includes(sig.mime)) return setError(sig ? `This file is ${sig.label}, not a supported image.` : 'This is not a recognised image file.');
    try {
      const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
      if (bitmap.width * bitmap.height > MAX_PIXELS) {
        bitmap.close();
        return setError('Images up to 50 megapixels are supported.');
      }
      set({ file, mime: sig.mime, url: URL.createObjectURL(file), bitmap, width: bitmap.width, height: bitmap.height });
    } catch {
      setError('Your browser could not decode this image.');
    }
  };
  const picker = (
    <>
      <FileDrop accept={accept} label="Choose image" onFiles={([f]) => void load(f)} />
      {error && <Status tone="error">{error}</Status>}
      {img && <p className="summary">{img.file.name} — {img.width} × {img.height} px, {formatBytes(img.file.size)}</p>}
    </>
  );
  return { img, picker, clear: () => set(null) };
}

export function canvasToBlob(canvas: HTMLCanvasElement, mime: string, quality?: number): Promise<Blob> {
  return new Promise((resolve, reject) =>
    canvas.toBlob((b) => {
      if (!b) return reject(new Error('The browser could not encode the image.'));
      if (b.type !== mime) return reject(new Error(`The browser produced ${b.type || 'an unknown type'} instead of ${mime}.`));
      resolve(b);
    }, mime, quality),
  );
}
