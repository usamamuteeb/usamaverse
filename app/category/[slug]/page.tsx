import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Breadcrumbs } from '@/components/Breadcrumbs';
import { ToolGrid } from '@/components/ToolCard';
import { getCategory } from '@/lib/tools/categories';
import { categoriesWithCounts, toolsInCategory } from '@/lib/tools/public';
import type { CategorySlug } from '@/lib/tools/types';

type Params = { slug: string };

export const dynamicParams = false;

export function generateStaticParams(): Params[] {
  return categoriesWithCounts().map((c) => ({ slug: c.slug }));
}

export async function generateMetadata({ params }: { params: Promise<Params> }): Promise<Metadata> {
  const { slug } = await params;
  const cat = getCategory(slug);
  return cat ? { title: `${cat.name} tools`, description: cat.description, alternates: { canonical: `/category/${cat.slug}` } } : {};
}

export default async function CategoryPage({ params }: { params: Promise<Params> }) {
  const { slug } = await params;
  const cat = getCategory(slug);
  if (!cat) notFound();
  const tools = toolsInCategory(cat.slug as CategorySlug);
  if (tools.length === 0) notFound();
  const others = categoriesWithCounts().filter((c) => c.slug !== cat.slug);
  return (
    <div className="container page">
      <Breadcrumbs items={[{ href: '/', label: 'Home' }, { href: '/tools', label: 'Tools' }, { label: cat.name }]} />
      <h1 className="h1">{cat.name} tools</h1>
      <p className="lead">
        {cat.description} {tools.length} tool{tools.length === 1 ? '' : 's'}.
      </p>
      <ToolGrid tools={tools} />
      <section className="section" aria-labelledby="other-cats">
        <h2 id="other-cats" className="h3">
          Other categories
        </h2>
        <ul className="pill-list" role="list">
          {others.map((c) => (
            <li key={c.slug}>
              <Link href={`/category/${c.slug}`}>
                {c.name} <span className="count">{c.count}</span>
              </Link>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
