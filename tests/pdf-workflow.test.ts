import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { PDFDocument } from 'pdf-lib';
import { parseWorkflowRecipe, runPdfWorkflow } from '../features/tools/pdf/workflow';

test('PDF workflow runs ordered page edits and preserves the result', async () => {
  const doc = await PDFDocument.create();
  doc.addPage([300, 400]); doc.addPage([400, 300]);
  const output = await runPdfWorkflow(new Uint8Array(await doc.save()), [
    { kind: 'remove', pages: '2' },
    { kind: 'rotate', pages: 'all', angle: 90 },
    { kind: 'numbers', pages: 'all', startAt: 3 },
    { kind: 'metadata', title: 'Workflow result', author: 'Usama' },
  ]);
  const reopened = await PDFDocument.load(output);
  assert.equal(reopened.getPageCount(), 1);
  assert.equal(reopened.getPage(0).getRotation().angle, 90);
  assert.equal(reopened.getTitle(), 'Workflow result');
  assert.equal(reopened.getAuthor(), 'Usama');
});

test('PDF recipe rejects unrecognized steps', () => {
  assert.throws(() => parseWorkflowRecipe('[{"kind":"upload"}]'), /not a supported/);
  assert.throws(() => parseWorkflowRecipe('[]'), /1–20/);
});
