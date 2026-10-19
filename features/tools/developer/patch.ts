/** Read-only unified diff (git diff / diff -u) parser. Nothing is applied. */
export interface PatchLine {
  type: 'add' | 'del' | 'ctx' | 'meta';
  text: string;
  oldNo?: number;
  newNo?: number;
}
export interface PatchHunk {
  header: string;
  lines: PatchLine[];
}
export interface PatchFile {
  oldPath: string;
  newPath: string;
  status: 'modified' | 'added' | 'deleted' | 'renamed' | 'binary';
  hunks: PatchHunk[];
  added: number;
  removed: number;
}

const clean = (p: string) => p.replace(/^"|"$/g, '').replace(/^[ab]\//, '').replace(/\t.*$/, '');

export function parsePatch(src: string): PatchFile[] {
  const lines = src.replace(/\r\n?/g, '\n').split('\n');
  const files: PatchFile[] = [];
  let file: PatchFile | null = null;
  let hunk: PatchHunk | null = null;
  let oldNo = 0;
  let newNo = 0;
  const start = (oldPath = '', newPath = '') => {
    file = { oldPath, newPath, status: 'modified', hunks: [], added: 0, removed: 0 };
    files.push(file);
    hunk = null;
  };
  for (let i = 0; i < lines.length; i++) {
    const l = lines[i];
    const git = l.match(/^diff --git (\S+) (\S+)/);
    if (git) {
      start(clean(git[1]), clean(git[2]));
      continue;
    }
    if (l.startsWith('--- ') && lines[i + 1]?.startsWith('+++ ')) {
      const oldP = l.slice(4).trim();
      const newP = lines[i + 1].slice(4).trim();
      if (!file || (file as PatchFile).hunks.length) start();
      const f = file as unknown as PatchFile;
      f.oldPath = oldP === '/dev/null' ? '' : clean(oldP);
      f.newPath = newP === '/dev/null' ? '' : clean(newP);
      if (oldP === '/dev/null') f.status = 'added';
      if (newP === '/dev/null') f.status = 'deleted';
      i++;
      continue;
    }
    const f = file as PatchFile | null;
    if (f && /^new file mode/.test(l)) f.status = 'added';
    else if (f && /^deleted file mode/.test(l)) f.status = 'deleted';
    else if (f && /^rename (from|to) /.test(l)) {
      f.status = 'renamed';
      if (l.startsWith('rename from ')) f.oldPath = l.slice(12);
      else f.newPath = l.slice(10);
    } else if (f && /^Binary files /.test(l)) f.status = 'binary';
    const h = l.match(/^@@ -(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@(.*)$/);
    if (h) {
      if (!file) start();
      hunk = { header: l, lines: [] };
      (file as unknown as PatchFile).hunks.push(hunk);
      oldNo = Number(h[1]);
      newNo = Number(h[3]);
      continue;
    }
    if (!hunk || !file) continue;
    const hk = hunk as PatchHunk;
    const fl = file as PatchFile;
    if (l.startsWith('+')) {
      hk.lines.push({ type: 'add', text: l.slice(1), newNo: newNo++ });
      fl.added++;
    } else if (l.startsWith('-')) {
      hk.lines.push({ type: 'del', text: l.slice(1), oldNo: oldNo++ });
      fl.removed++;
    } else if (l.startsWith(' ') || (l === '' && i < lines.length - 1)) hk.lines.push({ type: 'ctx', text: l.slice(1), oldNo: oldNo++, newNo: newNo++ });
    else if (l.startsWith('\\')) hk.lines.push({ type: 'meta', text: l });
  }
  if (!files.length) throw new Error('No unified diff found. Paste output from “git diff” or “diff -u”.');
  return files;
}
