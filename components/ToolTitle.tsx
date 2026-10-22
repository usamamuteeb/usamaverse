import Link from 'next/link';
import type { ReactNode } from 'react';
import type { ToolMeta } from '@/lib/tools/types';
import { categoryName } from '@/lib/tools/public';
import { categoryEmoji } from '@/lib/ui-icons';

/** One compact row: where you are, the tool name, a privacy badge and actions. */
export function ToolTitle({ tool, workspace, actions }: { tool: ToolMeta; workspace?: { slug: string; name: string }; actions?: ReactNode }) {
  return (
    <header className="tool-title">
      <div className="tool-title-main">
        <nav aria-label="Breadcrumb" className="crumbs">
          <Link href="/">Home</Link>
          <span aria-hidden="true">/</span>
          <Link href={`/category/${tool.category}`}>{categoryName(tool.category)}</Link>
          {workspace && (
            <>
              <span aria-hidden="true">/</span>
              <Link href={`/workspaces/${workspace.slug}`}>{workspace.name}</Link>
            </>
          )}
        </nav>
        <h1 className="tool-title-h1">
          <span className="tool-title-icon" aria-hidden="true">
            {categoryEmoji[tool.category]}
          </span>
          {tool.name}
        </h1>
        <p className="tool-title-desc">{tool.description}</p>
      </div>
      <div className="tool-title-side">
        <span className="local-pill" title={tool.processing === 'browser-local' ? 'What you enter is processed on this device and never uploaded.' : 'This tool sends your input to a server.'}>
          <span aria-hidden="true">●</span> {tool.processing === 'browser-local' ? 'Runs in your browser' : 'Uses a server'}
        </span>
        {actions}
      </div>
    </header>
  );
}

/** “Good to know” notes, collapsed by default so the tool stays at the top. */
export function ToolNotes({ tool }: { tool: ToolMeta }) {
  if (!tool.howTo?.length && !tool.limits?.length) return null;
  return (
    <details className="tool-notes-details">
      <summary>Good to know about {tool.name}</summary>
      {tool.howTo && (
        <ol>
          {tool.howTo.map((s) => (
            <li key={s}>{s}</li>
          ))}
        </ol>
      )}
      {tool.limits && (
        <ul>
          {tool.limits.map((s) => (
            <li key={s}>{s}</li>
          ))}
        </ul>
      )}
    </details>
  );
}
