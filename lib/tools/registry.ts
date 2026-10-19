import { implementedTools } from './registry.implemented';
import { plannedTools } from './registry.planned';
import type { ToolMeta } from './types';

/**
 * Full registry (implemented + planned) for tooling, tests and CI checks.
 * Public UI must import from ./public instead, which only exposes implemented tools.
 */
export const registry: ToolMeta[] = [...implementedTools, ...plannedTools];
