import { test } from 'node:test';
import assert from 'node:assert/strict';
import { publicTools } from '@/lib/tools/public';
import { getWorkspace, workspaceForTool, workspaces } from '@/lib/tools/workspaces';
import { hitOverlay, moveOverlay, overlayBounds } from '@/features/tools/pdf/editor-model';
import type { Overlay } from '@/features/tools/pdf/ops';

test('each public action has exactly one focused workspace', () => {
  const all = workspaces.flatMap((workspace) => workspace.tools.map((tool) => tool.slug));
  assert.equal(new Set(all).size, all.length);
  assert.deepEqual(all.slice().sort(), publicTools.map((tool) => tool.slug).sort());
  for (const workspace of workspaces) {
    assert.equal(getWorkspace(workspace.slug), workspace);
    for (const tool of workspace.tools) assert.equal(workspaceForTool(tool.slug), workspace);
  }
});

test('PDF editor selection targets the topmost addition on the current page', () => {
  const items: Overlay[] = [
    { kind: 'rect', page: 0, x: 10, y: 10, width: 100, height: 50, fill: '#ffffff' },
    { kind: 'text', page: 0, x: 20, y: 30, text: 'Edit me', size: 14, font: 'Helvetica', color: '#000000' },
    { kind: 'rect', page: 1, x: 10, y: 10, width: 100, height: 50, fill: '#ffffff' },
  ];
  assert.equal(hitOverlay(items, 0, { x: 25, y: 31 }), 1);
  assert.equal(hitOverlay(items, 1, { x: 25, y: 31 }), 2);
  assert.equal(hitOverlay(items, 0, { x: 150, y: 150 }), null);
  const moved = moveOverlay(items[1], 15, -5);
  assert.equal(moved.kind, 'text');
  if (moved.kind === 'text') assert.deepEqual([moved.x, moved.y], [35, 25]);
  assert.ok(overlayBounds(moved).width > 0);
});
