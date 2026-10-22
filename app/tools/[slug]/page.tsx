import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { FavoriteButton } from '@/components/FavoriteButton';
import { ToolRunner } from '@/components/ToolRunner';
import { ToolNotes, ToolTitle } from '@/components/ToolTitle';
import { WorkspaceNav } from '@/components/WorkspaceNav';
import { getPublicTool, publicTools, relatedTools } from '@/lib/tools/public';
import { workspaceForTool } from '@/lib/tools/workspaces';

type Params = { slug: string };

export const dynamicParams = false; // unknown and planned slugs are 404s

export function generateStaticParams(): Params[] {
  return publicTools.map((t) => ({ slug: t.slug }));
}

export async function generateMetadata({ params }: { params: Promise<Params> }): Promise<Metadata> {
  const { slug } = await params;
  const tool = getPublicTool(slug);
  if (!tool) return {};
  return { title: tool.name, description: tool.description, alternates: { canonical: `/tools/${tool.slug}` } };
}

export default async function ToolPage({ params }: { params: Promise<Params> }) {
  const { slug } = await params;
  const tool = getPublicTool(slug);
  if (!tool) notFound();
  const group = workspaceForTool(tool.slug);
  const related = relatedTools(tool);

  return (
    <div className="container page shell-page">
      <div className="shell">
        <aside className="shell-side">
          <WorkspaceNav category={tool.category} workspace={group?.slug} active={tool.slug} mode="tool" />
        </aside>
        <div className="shell-main">
          <ToolTitle
            tool={tool}
            workspace={group ? { slug: group.slug, name: group.name } : undefined}
            actions={
              <>
                <FavoriteButton slug={tool.slug} name={tool.name} />
                {group && (
                  <Link href={`/workspaces/${group.slug}?tool=${tool.slug}`} className="btn btn-ghost btn-sm">
                    Open in workspace ↗
                  </Link>
                )}
              </>
            }
          />
          <section className="workspace glass" aria-label={`${tool.name} workspace`}>
            <ToolRunner slug={tool.slug} name={tool.name} />
          </section>
          <ToolNotes tool={tool} />
          {related.length > 0 && (
            <nav className="related-row" aria-label="Related tools">
              <span className="related-label">Related:</span>
              {related.map((r) => (
                <Link key={r.slug} href={`/tools/${r.slug}`} className="chip">
                  {r.name}
                </Link>
              ))}
            </nav>
          )}
        </div>
      </div>
    </div>
  );
}
