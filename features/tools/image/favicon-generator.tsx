'use client';

import { useState } from 'react';
import { Button, CopyButton, DownloadBlobButton } from '@/components/tool-kit/actions';
import { Status, TextField } from '@/components/tool-kit/fields';
import { formatBytes } from '@/lib/format';
import { createZip } from '@/features/tools/files/zip';
import { buildIco, FAVICON_SIZES, fitPlan } from './more';
import { canvasToBlob, useImageFile } from './useImage';

const SNIPPET = `<link rel="icon" href="/favicon.ico" sizes="48x48">
<link rel="icon" type="image/png" sizes="32x32" href="/favicon-32x32.png">
<link rel="apple-touch-icon" href="/apple-touch-icon.png">
<link rel="manifest" href="/site.webmanifest">`;

export default function FaviconGenerator() {
  const { img, picker } = useImageFile();
  const [bg, setBg] = useState('#ffffff');
  const [zip, setZip] = useState<Blob | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  return (
    <div className="tool-grid">
      <div className="tool-col">
        {picker}
        {img && img.width !== img.height && <Status tone="info">Your image isn’t square; it will be centered with transparent padding.</Status>}
        {img && Math.min(img.width, img.height) < 512 && <Status tone="warn">For sharp results start from an image at least 512 × 512 px.</Status>}
        <TextField type="color" label="Background for the Apple touch icon (it can’t be transparent)" value={bg} onChange={setBg} />
        {img && (
          <Button
            variant="primary"
            disabled={busy}
            onClick={async () => {
              setError(null);
              setBusy(true);
              try {
                const pngs: Record<number, Uint8Array> = {};
                for (const size of FAVICON_SIZES) {
                  const c = document.createElement('canvas');
                  c.width = c.height = size;
                  const ctx = c.getContext('2d')!;
                  ctx.imageSmoothingQuality = 'high';
                  if (size === 180) {
                    ctx.fillStyle = bg;
                    ctx.fillRect(0, 0, size, size);
                  }
                  const p = fitPlan(img.width, img.height, size, size, 'contain');
                  ctx.drawImage(img.bitmap, p.sx, p.sy, p.sw, p.sh, p.dx, p.dy, p.dw, p.dh);
                  pngs[size] = new Uint8Array(await (await canvasToBlob(c, 'image/png')).arrayBuffer());
                }
                const ico = buildIco([16, 32, 48].map((s) => ({ size: s, bytes: pngs[s] })));
                const manifest = JSON.stringify({ name: '', short_name: '', icons: [{ src: '/android-chrome-192x192.png', sizes: '192x192', type: 'image/png' }, { src: '/android-chrome-512x512.png', sizes: '512x512', type: 'image/png' }], theme_color: '#ffffff', background_color: '#ffffff', display: 'standalone' }, null, 2);
                const enc = new TextEncoder();
                const r = await createZip(
                  [
                    { name: 'favicon.ico', data: ico },
                    { name: 'favicon-16x16.png', data: pngs[16] },
                    { name: 'favicon-32x32.png', data: pngs[32] },
                    { name: 'apple-touch-icon.png', data: pngs[180] },
                    { name: 'android-chrome-192x192.png', data: pngs[192] },
                    { name: 'android-chrome-512x512.png', data: pngs[512] },
                    { name: 'site.webmanifest', data: enc.encode(manifest) },
                    { name: 'snippet.html', data: enc.encode(SNIPPET + '\n') },
                  ],
                  { compress: true },
                );
                setZip(new Blob([r.bytes as BlobPart], { type: 'application/zip' }));
              } catch (e) {
                setError(e instanceof Error ? e.message : String(e));
              } finally {
                setBusy(false);
              }
            }}
          >
            {busy ? 'Generating…' : 'Generate favicons'}
          </Button>
        )}
      </div>
      <div className="tool-col">
        {error && <Status tone="error">{error}</Status>}
        {zip ? (
          <>
            <Status tone="success">favicon.ico (16/32/48), PNG icons, apple-touch-icon and a web manifest ({formatBytes(zip.size)}).</Status>
            <DownloadBlobButton blob={zip} filename="favicons.zip" label="Download ZIP" />
          </>
        ) : (
          <p className="empty-state">Choose a square logo or icon to generate favicon files.</p>
        )}
        <div className="output-head"><span className="field-label">HTML for your &lt;head&gt;</span><CopyButton text={SNIPPET} /></div>
        <pre className="code-block">{SNIPPET}</pre>
      </div>
    </div>
  );
}
