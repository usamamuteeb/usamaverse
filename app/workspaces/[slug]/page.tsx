import type { Metadata } from 'next';
import { Suspense } from 'react';
import { notFound } from 'next/navigation';
import { WorkspaceRunner } from '@/components/WorkspaceRunner';
import { ToolLoading } from '@/components/ToolLoading';
import { getWorkspace, workspaces } from '@/lib/tools/workspaces';

type Params = { slug: string };
export const dynamicParams = false;
export function generateStaticParams(): Params[] {
  return workspaces.map(({ slug }) => ({ slug }));
}
export async function generateMetadata({ params }: { params: Promise<Params> }): Promise<Metadata> {
  const workspace = getWorkspace((await params).slug);
  return workspace ? { title: workspace.name, description: workspace.description, alternates: { canonical: `/workspaces/${workspace.slug}` } } : {};
}

export default async function WorkspacePage({ params }: { params: Promise<Params> }) {
  const workspace = getWorkspace((await params).slug);
  if (!workspace) notFound();
  return (
    <div className="container page shell-page">
      <Suspense fallback={<ToolLoading name={workspace.name} />}>
        <WorkspaceRunner workspace={workspace} />
      </Suspense>
    </div>
  );
}
