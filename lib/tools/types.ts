export type ToolPhase = 'launch-basic' | 'basic-expansion' | 'advanced';
export type ToolStatus = 'implemented' | 'planned';
export type ProcessingMode = 'browser-local' | 'server-required';

export type CategorySlug =
  | 'text'
  | 'developer'
  | 'generators'
  | 'image'
  | 'pdf'
  | 'files'
  | 'math'
  | 'units'
  | 'dates'
  | 'color'
  | 'web'
  | 'csv'
  | 'media'
  | 'language'
  | 'misc';

export interface ToolMeta {
  id: string;
  slug: string;
  name: string;
  category: CategorySlug;
  description: string;
  aliases: string[];
  tags: string[];
  phase: ToolPhase;
  status: ToolStatus;
  processing: ProcessingMode;
  related: string[];
  /** Short how-to steps shown on the tool page. */
  howTo?: string[];
  /** Honest limits / caveats shown on the tool page. */
  limits?: string[];
}

export interface Category {
  slug: CategorySlug;
  name: string;
  description: string;
}
