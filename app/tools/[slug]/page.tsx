import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Breadcrumbs } from '@/components/Breadcrumbs';
import { FavoriteButton } from '@/components/FavoriteButton';
import { ToolGrid } from '@/components/ToolCard';
import { ToolRunner } from '@/components/ToolRunner';
import { categoryName, getPublicTool, publicTools, relatedTools } from '@/lib/tools/public';

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
  const related = relatedTools(tool);

  return (
    <div className="container page">
      <Breadcrumbs items={[{ href: '/', label: 'Home' }, { href: `/category/${tool.category}`, label: categoryName(tool.category) }, { label: tool.name }]} />
      <header className="tool-header">
        <div>
          <h1 className="h1">{tool.name}</h1>
          <p className="lead">{tool.description}</p>
        </div>
        <FavoriteButton slug={tool.slug} name={tool.name} />
      </header>
      <p className="privacy-note">
        <span className="badge" aria-hidden="true">
          ●
        </span>{' '}
        {tool.processing === 'browser-local' ? (
          <>
            <strong>Runs in your browser.</strong> What you enter is processed on this device and is not uploaded.
          </>
        ) : (
          <>
            <strong>Uses a server.</strong> Your input is sent to process it.
          </>
        )}
      </p>

      <section className="workspace" aria-label={`${tool.name} workspace`}>
        <ToolRunner slug={tool.slug} />
      </section>

      {Boolean(tool.howTo?.length || tool.limits?.length) && (
        <section className="tool-notes" aria-labelledby="notes-h">
          <h2 id="notes-h" className="h2">
            Good to know
          </h2>
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
        </section>
      )}

      {related.length > 0 && (
        <section aria-labelledby="related-h" className="section">
          <h2 id="related-h" className="h2">
            Related tools
          </h2>
          <ToolGrid tools={related} />
          <p>
            <Link href={`/category/${tool.category}`}>More {categoryName(tool.category).toLowerCase()} tools →</Link>
          </p>
        </section>
      )}
    </div>
  );
}
