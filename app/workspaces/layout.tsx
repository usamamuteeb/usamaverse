'use client';

import { PdfWorkspaceProvider } from '@/features/tools/files/usePdf';
import type { ReactNode } from 'react';

export default function WorkspacesLayout({ children }: { children: ReactNode }) {
  return <PdfWorkspaceProvider>{children}</PdfWorkspaceProvider>;
}
