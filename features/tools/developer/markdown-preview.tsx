'use client';

import { useDeferredValue, useMemo, useState } from 'react';
import { Button, CopyButton, DownloadTextButton, OpenTextFileButton } from '@/components/tool-kit/actions';
import { Status, TextAreaField } from '@/components/tool-kit/fields';
import { renderMarkdown } from './markdown';

const EXAMPLE = `# Heading

Some **bold**, *italic*, ~~struck~~ and \`inline code\`.

- A list item
- [A link](https://example.com)

> A quote

| Tool | Local |
|------|:-----:|
| Markdown | ✓ |

\`\`\`js
const safe = "<script> is shown as text";
\`\`\`

<b>Raw HTML is displayed, not run.</b>`;

export default function MarkdownPreview() {
  const [src, setSrc] = useState('');
  const [error, setError] = useState<string | null>(null);
  const deferred = useDeferredValue(src);
  // renderMarkdown escapes all input before generating tags, so this HTML is safe to insert.
  const html = useMemo(() => renderMarkdown(deferred), [deferred]);

  return (
    <div className="tool-grid">
      <div className="tool-col">
        <TextAreaField label="Markdown" value={src} onChange={setSrc} rows={18} placeholder="# Start writing…" />
        <div className="actions">
          <Button variant="ghost" onClick={() => setSrc(EXAMPLE)}>
            Load example
          </Button>
          <OpenTextFileButton accept=".md,.markdown,.txt,text/markdown,text/plain" onText={(t) => setSrc(t)} onError={setError} />
          <Button variant="ghost" onClick={() => setSrc('')}>
            Reset
          </Button>
        </div>
        {error && <Status tone="error">{error}</Status>}
      </div>
      <div className="tool-col">
        <div className="output-head">
          <h2 className="field-label" id="md-preview-label">
            Preview
          </h2>
          <div className="actions">
            <CopyButton text={html} label="Copy HTML" />
            <DownloadTextButton text={html} filename="markdown.html" mime="text/html" label="Download HTML" />
          </div>
        </div>
        {deferred ? <div className="prose md-preview" aria-labelledby="md-preview-label" dangerouslySetInnerHTML={{ __html: html }} /> : <p className="empty-state">The preview will appear here.</p>}
      </div>
    </div>
  );
}
