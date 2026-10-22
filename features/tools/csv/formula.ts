/**
 * Spreadsheet formula builder and explainer. It only produces formula text —
 * nothing is evaluated — for Excel, Google Sheets and LibreOffice Calc.
 */

export type App = 'excel' | 'sheets' | 'calc';
export interface FormulaSettings {
  app: App;
  /** "," (US/UK) or ";" (most of Europe, and always in LibreOffice in many locales). */
  sep: ',' | ';';
  /** Use 365/Sheets functions (XLOOKUP, FILTER, UNIQUE, TEXTJOIN…); off = works in older Excel. */
  modern: boolean;
}

export type FieldKind = 'ref' | 'range' | 'text' | 'number' | 'select';
export interface TaskField {
  key: string;
  label: string;
  kind: FieldKind;
  default: string;
  choices?: Array<{ value: string; label: string }>;
  hint?: string;
}
export interface FormulaTask {
  id: string;
  group: string;
  label: string;
  fields: TaskField[];
  build: (v: Record<string, string>, s: FormulaSettings) => { formula: string; explain: string; note?: string };
}

const OPS = [
  { value: 'eq', label: 'equals' },
  { value: 'ne', label: 'does not equal' },
  { value: 'gt', label: 'is greater than' },
  { value: 'ge', label: 'is at least' },
  { value: 'lt', label: 'is less than' },
  { value: 'le', label: 'is at most' },
  { value: 'contains', label: 'contains' },
  { value: 'starts', label: 'starts with' },
  { value: 'ends', label: 'ends with' },
  { value: 'blank', label: 'is blank' },
  { value: 'notblank', label: 'is not blank' },
];
const OP_SYM: Record<string, string> = { eq: '=', ne: '<>', gt: '>', ge: '>=', lt: '<', le: '<=' };
const OP_WORD: Record<string, string> = Object.fromEntries(OPS.map((o) => [o.value, o.label]));

/** A formula string literal, with quotes doubled. */
export const q = (s: string) => `"${s.replace(/"/g, '""')}"`;
const isNum = (s: string) => /^-?\d+(\.\d+)?$/.test(s.trim());
const CELL = String.raw`\$?[A-Za-z]{1,3}\$?\d+`;
const SHEET = String.raw`(?:'[^']+'|[A-Za-z_][\w.]*)!`;
const REF_RE = new RegExp(String.raw`^(${SHEET})?(${CELL}(:${CELL})?|\$?[A-Za-z]{1,3}:\$?[A-Za-z]{1,3}|\$?\d+:\$?\d+)$`);
/** A1-style cell, range, whole column (A:A) or whole row (2:2), optionally with a sheet name. */
export const isRef = (s: string) => REF_RE.test(s.trim());
/** A cell reference, number or text typed by the user, as a formula operand. */
export const operand = (s: string) => {
  const t = s.trim();
  if (t === '') return '""';
  if (isNum(t) || isRef(t) || /^(TRUE|FALSE)$/i.test(t) || /^[A-Z][A-Z0-9.]*\(.*\)$/i.test(t)) return t;
  return q(t);
};

/** Criteria text for SUMIF/COUNTIF-style functions. */
export function criterion(op: string, value: string): string {
  const v = value.trim();
  if (op === 'blank') return '""';
  if (op === 'notblank') return '"<>"';
  if (op === 'contains') return isRef(v) ? `"*"&${v}&"*"` : q(`*${v}*`);
  if (op === 'starts') return isRef(v) ? `${v}&"*"` : q(`${v}*`);
  if (op === 'ends') return isRef(v) ? `"*"&${v}` : q(`*${v}`);
  const sym = OP_SYM[op] ?? '=';
  if (isRef(v)) return sym === '=' ? v : `${q(sym)}&${v}`;
  if (sym === '=') return isNum(v) ? v : q(v);
  return q(`${sym}${v}`);
}

/** A logical test of one cell for IF/FILTER. */
export function test(cell: string, op: string, value: string): string {
  const v = value.trim();
  if (op === 'blank') return `${cell}=""`;
  if (op === 'notblank') return `${cell}<>""`;
  if (op === 'contains') return `ISNUMBER(SEARCH(${operand(v)}, ${cell}))`;
  if (op === 'starts') return `LEFT(${cell}, LEN(${operand(v)}))=${operand(v)}`;
  if (op === 'ends') return `RIGHT(${cell}, LEN(${operand(v)}))=${operand(v)}`;
  return `${cell}${OP_SYM[op] ?? '='}${operand(v)}`;
}

/** Replaces the US "," argument separator with the chosen one (outside string literals). */
export function withSep(f: string, sep: ',' | ';'): string {
  if (sep === ',') return f;
  let out = '';
  let inStr = false;
  for (const ch of f) {
    if (ch === '"') inStr = !inStr;
    out += !inStr && ch === ',' ? ';' : ch;
  }
  return out;
}

const describeCond = (range: string, op: string, value: string) => `${range} ${OP_WORD[op]}${op === 'blank' || op === 'notblank' ? '' : ` “${value}”`}`;

const opField = (key: string, def = 'eq'): TaskField => ({ key, label: 'Condition', kind: 'select', default: def, choices: OPS });

export const TASKS: FormulaTask[] = [
  {
    id: 'aggregate',
    group: 'Totals',
    label: 'Sum, average, count, min or max of a range',
    fields: [
      { key: 'fn', label: 'Calculation', kind: 'select', default: 'SUM', choices: [{ value: 'SUM', label: 'Sum' }, { value: 'AVERAGE', label: 'Average' }, { value: 'COUNT', label: 'Count numbers' }, { value: 'COUNTA', label: 'Count non-empty cells' }, { value: 'COUNTBLANK', label: 'Count blank cells' }, { value: 'MIN', label: 'Smallest' }, { value: 'MAX', label: 'Largest' }, { value: 'MEDIAN', label: 'Median' }] },
      { key: 'range', label: 'Range', kind: 'range', default: 'B2:B100' },
    ],
    build: (v) => ({ formula: `=${v.fn}(${v.range})`, explain: `${v.fn} looks at every cell in ${v.range}${v.fn === 'COUNT' ? ' and counts the ones holding numbers' : v.fn === 'COUNTA' ? ' and counts the cells that are not empty' : v.fn === 'COUNTBLANK' ? ' and counts the empty cells' : '; text and blank cells are ignored'}.` }),
  },
  {
    id: 'conditional',
    group: 'Totals',
    label: 'Sum / count / average where a condition is met',
    fields: [
      { key: 'fn', label: 'Calculation', kind: 'select', default: 'SUMIF', choices: [{ value: 'SUMIF', label: 'Sum' }, { value: 'COUNTIF', label: 'Count' }, { value: 'AVERAGEIF', label: 'Average' }, { value: 'MAXIFS', label: 'Largest' }, { value: 'MINIFS', label: 'Smallest' }] },
      { key: 'crit', label: 'Check this range', kind: 'range', default: 'A2:A100' },
      opField('op'),
      { key: 'value', label: 'Value (text, number or a cell like E1)', kind: 'text', default: 'North' },
      { key: 'sum', label: 'Add up / average this range', kind: 'range', default: 'C2:C100', hint: 'Not used for Count.' },
    ],
    build: (v) => {
      const c = criterion(v.op, v.value);
      const formula = v.fn === 'COUNTIF' ? `=COUNTIF(${v.crit}, ${c})` : v.fn === 'MAXIFS' || v.fn === 'MINIFS' ? `=${v.fn}(${v.sum}, ${v.crit}, ${c})` : `=${v.fn}(${v.crit}, ${c}, ${v.sum})`;
      const what = { SUMIF: `adds the matching values from ${v.sum}`, COUNTIF: 'counts the matching rows', AVERAGEIF: `averages the matching values from ${v.sum}`, MAXIFS: `returns the largest matching value from ${v.sum}`, MINIFS: `returns the smallest matching value from ${v.sum}` }[v.fn];
      return { formula, explain: `Rows where ${describeCond(v.crit, v.op, v.value)}; the formula ${what}. Criteria text is not case-sensitive and * matches any characters.`, note: v.fn === 'MAXIFS' || v.fn === 'MINIFS' ? 'MAXIFS/MINIFS need Excel 2019 or later, Google Sheets or LibreOffice 5.2+.' : undefined };
    },
  },
  {
    id: 'two-conditions',
    group: 'Totals',
    label: 'Sum / count with two conditions (AND)',
    fields: [
      { key: 'fn', label: 'Calculation', kind: 'select', default: 'SUMIFS', choices: [{ value: 'SUMIFS', label: 'Sum' }, { value: 'COUNTIFS', label: 'Count' }, { value: 'AVERAGEIFS', label: 'Average' }] },
      { key: 'sum', label: 'Add up / average this range', kind: 'range', default: 'D2:D100', hint: 'Not used for Count.' },
      { key: 'r1', label: 'First range', kind: 'range', default: 'A2:A100' },
      opField('op1'),
      { key: 'v1', label: 'First value', kind: 'text', default: 'North' },
      { key: 'r2', label: 'Second range', kind: 'range', default: 'B2:B100' },
      opField('op2', 'ge'),
      { key: 'v2', label: 'Second value', kind: 'text', default: '100' },
    ],
    build: (v) => {
      const pairs = `${v.r1}, ${criterion(v.op1, v.v1)}, ${v.r2}, ${criterion(v.op2, v.v2)}`;
      return { formula: v.fn === 'COUNTIFS' ? `=COUNTIFS(${pairs})` : `=${v.fn}(${v.sum}, ${pairs})`, explain: `Only rows where ${describeCond(v.r1, v.op1, v.v1)} AND ${describeCond(v.r2, v.op2, v.v2)} are included. All ranges must be the same size.` };
    },
  },
  {
    id: 'lookup',
    group: 'Lookup',
    label: 'Find a value in a table (lookup)',
    fields: [
      { key: 'key', label: 'Look for (cell or value)', kind: 'text', default: 'F2' },
      { key: 'in', label: 'In this column', kind: 'range', default: 'A2:A500' },
      { key: 'ret', label: 'Return from this column', kind: 'range', default: 'C2:C500' },
      { key: 'missing', label: 'If not found, show', kind: 'text', default: 'Not found' },
    ],
    build: (v, s) => {
      const key = operand(v.key);
      if (s.modern) return { formula: `=XLOOKUP(${key}, ${v.in}, ${v.ret}, ${q(v.missing)})`, explain: `XLOOKUP searches ${v.in} for an exact match of ${v.key} and returns the value in the same row of ${v.ret}; “${v.missing}” is shown when nothing matches.`, note: s.app === 'calc' ? 'XLOOKUP needs LibreOffice 24.8 or later — turn off "newer functions" for INDEX/MATCH.' : 'XLOOKUP needs Excel 2021/365 or Google Sheets.' };
      return { formula: `=IFERROR(INDEX(${v.ret}, MATCH(${key}, ${v.in}, 0)), ${q(v.missing)})`, explain: `MATCH(…, 0) finds the position of the exact match of ${v.key} in ${v.in}; INDEX returns the value at that position in ${v.ret}; IFERROR shows “${v.missing}” when there is no match. Works in every spreadsheet version, and the columns can be in any order.` };
    },
  },
  {
    id: 'vlookup',
    group: 'Lookup',
    label: 'VLOOKUP from a table',
    fields: [
      { key: 'key', label: 'Look for (cell or value)', kind: 'text', default: 'F2' },
      { key: 'table', label: 'Table (lookup column first)', kind: 'range', default: '$A$2:$D$500' },
      { key: 'col', label: 'Return column number in the table', kind: 'number', default: '3' },
      { key: 'exact', label: 'Match', kind: 'select', default: 'FALSE', choices: [{ value: 'FALSE', label: 'Exact match' }, { value: 'TRUE', label: 'Closest lower value (sorted table)' }] },
    ],
    build: (v) => ({ formula: `=VLOOKUP(${operand(v.key)}, ${v.table}, ${Math.max(1, Math.round(Number(v.col) || 1))}, ${v.exact})`, explain: `Looks for ${v.key} in the first column of ${v.table} and returns column ${v.col} of the same row. ${v.exact === 'FALSE' ? 'FALSE means an exact match (shows #N/A if there is none).' : 'TRUE needs the first column sorted A→Z and returns the closest lower match — handy for tax brackets or grades.'}`, note: 'The $ signs keep the table fixed when you fill the formula down.' }),
  },
  {
    id: 'if',
    group: 'Logic',
    label: 'IF a cell meets a condition, show one thing, else another',
    fields: [
      { key: 'cell', label: 'Cell', kind: 'ref', default: 'B2' },
      opField('op', 'ge'),
      { key: 'value', label: 'Value', kind: 'text', default: '50' },
      { key: 'yes', label: 'Then show', kind: 'text', default: 'Pass' },
      { key: 'no', label: 'Otherwise show', kind: 'text', default: 'Fail' },
    ],
    build: (v) => ({ formula: `=IF(${test(v.cell, v.op, v.value)}, ${operand(v.yes)}, ${operand(v.no)})`, explain: `When ${describeCond(v.cell, v.op, v.value)} the cell shows ${operand(v.yes)}, otherwise ${operand(v.no)}. Text is in quotes; cell references and numbers are not.` }),
  },
  {
    id: 'grade',
    group: 'Logic',
    label: 'Grade / band a number (several thresholds)',
    fields: [
      { key: 'cell', label: 'Cell', kind: 'ref', default: 'B2' },
      { key: 'bands', label: 'Bands (min=label, highest first)', kind: 'text', default: '90=A, 80=B, 70=C, 60=D', hint: 'Anything lower gets the fallback.' },
      { key: 'else', label: 'Fallback', kind: 'text', default: 'F' },
    ],
    build: (v, s) => {
      const bands = v.bands
        .split(/[,;\n]/)
        .map((b) => b.split('='))
        .filter((b) => b.length === 2 && b[0].trim() !== '')
        .map(([n, l]) => [n.trim(), l.trim()] as const)
        .sort((a, b) => Number(b[0]) - Number(a[0]));
      if (!bands.length) return { formula: '', explain: 'Add bands like 90=A, 80=B.' };
      if (s.modern) return { formula: `=IFS(${bands.map(([n, l]) => `${v.cell}>=${n}, ${operand(l)}`).join(', ')}, TRUE, ${operand(v.else)})`, explain: `IFS checks each condition in order and returns the label of the first one that is true; TRUE at the end catches everything below ${bands[bands.length - 1][0]}.` };
      let f = operand(v.else);
      for (const [n, l] of [...bands].reverse()) f = `IF(${v.cell}>=${n}, ${operand(l)}, ${f})`;
      return { formula: `=${f}`, explain: 'Nested IFs check the highest band first and fall through to the next one.' };
    },
  },
  {
    id: 'pct-change',
    group: 'Numbers',
    label: 'Percentage change / share',
    fields: [
      { key: 'kind', label: 'Calculation', kind: 'select', default: 'change', choices: [{ value: 'change', label: 'Change from old to new' }, { value: 'share', label: 'Part as % of total' }, { value: 'add', label: 'Add a percentage' }] },
      { key: 'a', label: 'Old value / part / amount', kind: 'ref', default: 'B2' },
      { key: 'b', label: 'New value / total / percent', kind: 'ref', default: 'C2' },
    ],
    build: (v) => {
      if (v.kind === 'share') return { formula: `=IFERROR(${v.a}/${v.b}, 0)`, explain: `Divides ${v.a} by ${v.b}. Format the cell as Percentage; IFERROR shows 0 when the total is 0 or empty.` };
      if (v.kind === 'add') return { formula: `=${v.a}*(1+${v.b})`, explain: `Increases ${v.a} by the percentage in ${v.b} (enter 15% or 0.15 there). Use 1-${v.b} to subtract instead.` };
      return { formula: `=IFERROR((${v.b}-${v.a})/${v.a}, "")`, explain: `(new − old) ÷ old. Format the cell as Percentage; a negative result is a decrease. Left blank when the old value is 0.` };
    },
  },
  {
    id: 'round',
    group: 'Numbers',
    label: 'Round a number',
    fields: [
      { key: 'cell', label: 'Cell or formula', kind: 'text', default: 'B2' },
      { key: 'fn', label: 'Rounding', kind: 'select', default: 'ROUND', choices: [{ value: 'ROUND', label: 'Nearest' }, { value: 'ROUNDUP', label: 'Always up' }, { value: 'ROUNDDOWN', label: 'Always down' }, { value: 'MROUND', label: 'To a multiple' }] },
      { key: 'n', label: 'Decimal places (or multiple)', kind: 'number', default: '2', hint: 'Negative places round to tens (-1), hundreds (-2)…' },
    ],
    build: (v) => ({ formula: `=${v.fn}(${v.cell}, ${v.n || 0})`, explain: v.fn === 'MROUND' ? `Rounds ${v.cell} to the nearest multiple of ${v.n} (e.g. 0.05 for prices, 15 for minutes).` : `${v.fn} keeps ${v.n} decimal place${v.n === '1' ? '' : 's'}; formatting a cell only hides digits, this changes the value.` }),
  },
  {
    id: 'running-total',
    group: 'Numbers',
    label: 'Running total',
    fields: [{ key: 'col', label: 'Column letter', kind: 'text', default: 'B' }, { key: 'first', label: 'First data row', kind: 'number', default: '2' }],
    build: (v) => ({ formula: `=SUM($${v.col}$${v.first}:${v.col}${v.first})`, explain: `Enter it next to row ${v.first} and fill down: the start $${v.col}$${v.first} is fixed while the end moves, so each row sums everything above it.` }),
  },
  {
    id: 'rank',
    group: 'Numbers',
    label: 'Rank a value in a list',
    fields: [
      { key: 'cell', label: 'Cell', kind: 'ref', default: 'B2' },
      { key: 'range', label: 'List', kind: 'range', default: '$B$2:$B$100' },
      { key: 'order', label: 'Order', kind: 'select', default: '0', choices: [{ value: '0', label: 'Largest = 1' }, { value: '1', label: 'Smallest = 1' }] },
    ],
    build: (v) => ({ formula: `=RANK.EQ(${v.cell}, ${v.range}, ${v.order})`, explain: 'Equal values share the same rank (the next rank is skipped).', note: 'In LibreOffice, RANK.EQ is available from version 4.3; plain RANK works everywhere.' }),
  },
  {
    id: 'join',
    group: 'Text',
    label: 'Join cells with a separator',
    fields: [{ key: 'range', label: 'Cells', kind: 'range', default: 'A2:C2' }, { key: 'sep', label: 'Separator', kind: 'text', default: ', ' }],
    build: (v, s) => {
      if (s.modern) return { formula: `=TEXTJOIN(${q(v.sep)}, TRUE, ${v.range})`, explain: `Joins the cells in ${v.range} with “${v.sep}” between them; TRUE skips empty cells.` };
      const m = /^\$?([A-Z]+)\$?(\d+):\$?([A-Z]+)\$?(\d+)$/i.exec(v.range.trim());
      const cells: string[] = [];
      if (m && m[2] === m[4]) {
        const toN = (c: string) => [...c.toUpperCase()].reduce((n, ch) => n * 26 + ch.charCodeAt(0) - 64, 0);
        const toC = (n: number) => {
          let s2 = '';
          for (; n > 0; n = Math.floor((n - 1) / 26)) s2 = String.fromCharCode(65 + ((n - 1) % 26)) + s2;
          return s2;
        };
        for (let c = toN(m[1]); c <= toN(m[3]) && cells.length < 30; c++) cells.push(`${toC(c)}${m[2]}`);
      }
      return cells.length ? { formula: `=${cells.join(`&${q(v.sep)}&`)}`, explain: 'Joins each cell with & — older versions have no TEXTJOIN. Empty cells still add a separator.' } : { formula: `=CONCATENATE(${v.range})`, explain: 'For older versions, list the cells one by one: =A2&", "&B2&", "&C2.' };
    },
  },
  {
    id: 'split-name',
    group: 'Text',
    label: 'First or last word (e.g. first/last name)',
    fields: [{ key: 'cell', label: 'Cell', kind: 'ref', default: 'A2' }, { key: 'part', label: 'Part', kind: 'select', default: 'first', choices: [{ value: 'first', label: 'First word' }, { value: 'last', label: 'Last word' }, { value: 'rest', label: 'Everything after the first word' }] }],
    build: (v, s) => {
      const c = `TRIM(${v.cell})`;
      if (v.part === 'first') return { formula: `=IFERROR(LEFT(${c}, FIND(" ", ${c})-1), ${c})`, explain: 'Takes the text before the first space; a single word is returned as is.' };
      if (v.part === 'rest') return { formula: `=IFERROR(MID(${c}, FIND(" ", ${c})+1, LEN(${c})), "")`, explain: 'Takes everything after the first space.' };
      if (s.modern && s.app !== 'calc') return { formula: `=TEXTAFTER(${c}, " ", -1, , , ${c})`, explain: 'TEXTAFTER with -1 returns the text after the last space.', note: s.app === 'sheets' ? 'Google Sheets: use =REGEXEXTRACT(TRIM(A2), "\\S+$") if TEXTAFTER is unavailable.' : 'TEXTAFTER needs Excel 365.' };
      return { formula: `=TRIM(RIGHT(SUBSTITUTE(${c}, " ", REPT(" ", 100)), 100))`, explain: 'Pads every space to 100 spaces, takes the last 100 characters and trims them — the classic “last word” trick that works in every version.' };
    },
  },
  {
    id: 'clean-text',
    group: 'Text',
    label: 'Clean or change the case of text',
    fields: [{ key: 'cell', label: 'Cell', kind: 'ref', default: 'A2' }, { key: 'fn', label: 'Change', kind: 'select', default: 'TRIM', choices: [{ value: 'TRIM', label: 'Remove extra spaces' }, { value: 'CLEAN', label: 'Remove line breaks & hidden characters' }, { value: 'UPPER', label: 'UPPER CASE' }, { value: 'LOWER', label: 'lower case' }, { value: 'PROPER', label: 'Title Case' }, { value: 'NUM', label: 'Turn number-text into a number' }] }],
    build: (v) => (v.fn === 'NUM' ? { formula: `=VALUE(TRIM(${v.cell}))`, explain: 'Converts text that looks like a number (e.g. imported " 1200 ") into a real number you can add up.' } : v.fn === 'CLEAN' ? { formula: `=TRIM(CLEAN(SUBSTITUTE(${v.cell}, CHAR(160), " ")))`, explain: 'CLEAN removes line breaks and control characters, SUBSTITUTE turns non-breaking spaces (common in copied web text) into normal spaces, and TRIM removes the extra spaces.' } : { formula: `=${v.fn}(${v.cell})`, explain: v.fn === 'TRIM' ? 'Removes spaces at the start and end and turns repeated spaces into one.' : `${v.fn} changes the letter case of ${v.cell}.` }),
  },
  {
    id: 'date-diff',
    group: 'Dates',
    label: 'Time between two dates',
    fields: [
      { key: 'a', label: 'Start date', kind: 'ref', default: 'A2' },
      { key: 'b', label: 'End date (or TODAY())', kind: 'text', default: 'TODAY()' },
      { key: 'unit', label: 'Count', kind: 'select', default: 'D', choices: [{ value: 'D', label: 'Days' }, { value: 'W', label: 'Working days (Mon–Fri)' }, { value: 'M', label: 'Whole months' }, { value: 'Y', label: 'Whole years (age)' }, { value: 'YMD', label: 'Years, months and days' }] },
    ],
    build: (v) => {
      const b = v.b.trim() || 'TODAY()';
      if (v.unit === 'D') return { formula: `=${b}-${v.a}`, explain: 'Dates are stored as day numbers, so subtracting gives the days between them. Format the result as Number, not Date.' };
      if (v.unit === 'W') return { formula: `=NETWORKDAYS(${v.a}, ${b})`, explain: 'Counts Monday–Friday days including both ends. Add a holiday range as a third argument to skip holidays.' };
      if (v.unit === 'YMD') return { formula: `=DATEDIF(${v.a}, ${b}, "Y")&" years, "&DATEDIF(${v.a}, ${b}, "YM")&" months, "&DATEDIF(${v.a}, ${b}, "MD")&" days"`, explain: 'DATEDIF counts whole years ("Y"), the months left over ("YM") and the days left over ("MD").' };
      return { formula: `=DATEDIF(${v.a}, ${b}, "${v.unit}")`, explain: `DATEDIF counts complete ${v.unit === 'Y' ? 'years — the usual way to work out an age' : 'months'}. The start date must not be after the end date.`, note: 'DATEDIF is not listed in Excel’s function menu, but it works.' };
    },
  },
  {
    id: 'date-add',
    group: 'Dates',
    label: 'Add days, working days or months to a date',
    fields: [
      { key: 'a', label: 'Date', kind: 'ref', default: 'A2' },
      { key: 'n', label: 'Amount (negative to subtract)', kind: 'number', default: '30' },
      { key: 'unit', label: 'Unit', kind: 'select', default: 'D', choices: [{ value: 'D', label: 'Days' }, { value: 'W', label: 'Working days' }, { value: 'M', label: 'Months' }, { value: 'EOM', label: 'Months, then end of month' }] },
    ],
    build: (v) => {
      const n = v.n || '0';
      if (v.unit === 'W') return { formula: `=WORKDAY(${v.a}, ${n})`, explain: `The date ${n} working days later, skipping Saturdays and Sundays.` };
      if (v.unit === 'M') return { formula: `=EDATE(${v.a}, ${n})`, explain: `The same day ${n} months later (31 Jan + 1 month = 28/29 Feb). Format the cell as Date.` };
      if (v.unit === 'EOM') return { formula: `=EOMONTH(${v.a}, ${n})`, explain: `The last day of the month ${n} months later — useful for due dates and month-end reports.` };
      return { formula: `=${v.a}+${n}`, explain: 'Adding a number to a date adds days.' };
    },
  },
  {
    id: 'date-text',
    group: 'Dates',
    label: 'Weekday, month name or a formatted date',
    fields: [{ key: 'a', label: 'Date', kind: 'ref', default: 'A2' }, { key: 'fmt', label: 'Show', kind: 'select', default: 'dddd', choices: [{ value: 'dddd', label: 'Weekday (Monday)' }, { value: 'ddd', label: 'Short weekday (Mon)' }, { value: 'mmmm', label: 'Month (January)' }, { value: 'mmm yyyy', label: 'Jan 2026' }, { value: 'yyyy-mm-dd', label: '2026-01-31' }, { value: 'dd/mm/yyyy', label: '31/01/2026' }, { value: 'Qq', label: 'Quarter (Q1)' }] }],
    build: (v) => (v.fmt === 'Qq' ? { formula: `="Q"&ROUNDUP(MONTH(${v.a})/3, 0)`, explain: 'Divides the month by 3 and rounds up to get the quarter.' } : { formula: `=TEXT(${v.a}, ${q(v.fmt)})`, explain: `TEXT turns the date into text in the “${v.fmt}” pattern. Format codes follow your spreadsheet’s language in some locales.` }),
  },
  {
    id: 'unique',
    group: 'Lists',
    label: 'Unique values, duplicates and filters',
    fields: [
      { key: 'kind', label: 'Task', kind: 'select', default: 'unique', choices: [{ value: 'unique', label: 'List of unique values' }, { value: 'count', label: 'Count unique values' }, { value: 'dupflag', label: 'Mark duplicates' }, { value: 'filter', label: 'Rows matching a condition' }] },
      { key: 'range', label: 'Range', kind: 'range', default: 'A2:A100' },
      { key: 'cell', label: 'First cell (for "Mark duplicates")', kind: 'ref', default: 'A2' },
      opField('op'),
      { key: 'value', label: 'Value (for filter)', kind: 'text', default: 'North' },
      { key: 'rows', label: 'Return these columns (for filter)', kind: 'range', default: 'A2:D100' },
    ],
    build: (v, s) => {
      if (v.kind === 'dupflag') return { formula: `=IF(COUNTIF(${v.range.replace(/^([A-Z]+)(\d+)/i, '$$$1$$$2').replace(/:([A-Z]+)(\d+)$/i, ':$$$1$$$2')}, ${v.cell})>1, "Duplicate", "")`, explain: `Counts how often each value appears in the fixed range; anything seen more than once is marked. Fill it down from ${v.cell}.` };
      if (v.kind === 'count') return s.modern ? { formula: `=COUNTA(UNIQUE(FILTER(${v.range}, ${v.range}<>"")))`, explain: 'FILTER drops blanks, UNIQUE removes repeats and COUNTA counts what is left.' } : { formula: `=SUMPRODUCT((${v.range}<>"")/COUNTIF(${v.range}, ${v.range}&""))`, explain: 'Each value adds 1 ÷ (times it appears), so every distinct value adds up to exactly 1. Works in every version.' };
      if (v.kind === 'filter') return { formula: `=FILTER(${v.rows}, ${test(v.range, v.op, v.value)}, "No matches")`, explain: `Returns every row of ${v.rows} where ${describeCond(v.range, v.op, v.value)}; results spill into the cells below.`, note: s.modern ? undefined : 'FILTER needs Excel 365/2021, Google Sheets or LibreOffice 24.8+. In older Excel use AutoFilter instead.' };
      return { formula: `=UNIQUE(FILTER(${v.range}, ${v.range}<>""))`, explain: 'Lists each value once (blanks removed); the list spills down and updates automatically. Wrap it in SORT(…) to sort it.', note: s.modern ? undefined : 'UNIQUE needs Excel 365/2021, Google Sheets or LibreOffice 24.8+. In older Excel use Data → Remove Duplicates on a copy.' };
    },
  },
  {
    id: 'iferror',
    group: 'Logic',
    label: 'Hide errors (#N/A, #DIV/0!) in a formula',
    fields: [{ key: 'f', label: 'Your formula (without =)', kind: 'text', default: 'B2/C2' }, { key: 'show', label: 'Show instead', kind: 'text', default: '' }],
    build: (v) => ({ formula: `=IFERROR(${v.f.replace(/^=/, '')}, ${operand(v.show)})`, explain: `Shows ${v.show ? `“${v.show}”` : 'an empty cell'} instead of any error. Use IFNA instead of IFERROR to hide only “not found” (#N/A) errors and still see real mistakes.` }),
  },
];

/** Plain-language descriptions of common functions, for the explainer. */
export const FUNCTION_HELP: Record<string, string> = {
  SUM: 'adds numbers', AVERAGE: 'average of numbers', COUNT: 'counts cells with numbers', COUNTA: 'counts non-empty cells', COUNTBLANK: 'counts empty cells', MIN: 'smallest number', MAX: 'largest number', MEDIAN: 'middle value',
  SUMIF: 'adds values where one condition is met', SUMIFS: 'adds values where all conditions are met', COUNTIF: 'counts cells meeting a condition', COUNTIFS: 'counts rows meeting all conditions', AVERAGEIF: 'average where a condition is met', AVERAGEIFS: 'average where all conditions are met', MAXIFS: 'largest value meeting conditions', MINIFS: 'smallest value meeting conditions',
  IF: 'chooses between two results based on a test', IFS: 'returns the result of the first true condition', IFERROR: 'replaces any error with another value', IFNA: 'replaces #N/A with another value', AND: 'true when all tests are true', OR: 'true when any test is true', NOT: 'reverses true/false', SWITCH: 'matches a value against a list of cases', XOR: 'true when an odd number of tests are true',
  VLOOKUP: 'finds a row by its first column and returns another column', HLOOKUP: 'like VLOOKUP but across rows', XLOOKUP: 'finds a value and returns the matching item from another range', LOOKUP: 'approximate lookup in a sorted range', INDEX: 'value at a given row/column of a range', MATCH: 'position of a value in a range', XMATCH: 'position of a value (newer MATCH)', OFFSET: 'a range shifted by rows/columns', INDIRECT: 'a reference built from text', CHOOSE: 'picks the nth value from a list', ROW: 'row number', COLUMN: 'column number', ROWS: 'number of rows in a range', COLUMNS: 'number of columns in a range',
  FILTER: 'rows that meet a condition', SORT: 'sorts a range', SORTBY: 'sorts a range by another range', UNIQUE: 'removes duplicates', SEQUENCE: 'a list of numbers', TRANSPOSE: 'swaps rows and columns', LET: 'names values inside a formula', LAMBDA: 'a reusable custom function',
  SUMPRODUCT: 'multiplies ranges and adds the results', ROUND: 'rounds to N digits', ROUNDUP: 'rounds up', ROUNDDOWN: 'rounds down', MROUND: 'rounds to a multiple', INT: 'rounds down to a whole number', TRUNC: 'cuts off decimals', ABS: 'absolute value', MOD: 'remainder after division', POWER: 'raises to a power', SQRT: 'square root', RAND: 'random number 0–1', RANDBETWEEN: 'random whole number in a range', RANK: 'rank of a number in a list', 'RANK.EQ': 'rank of a number in a list', PERCENTILE: 'value at a percentile', LARGE: 'the nth largest value', SMALL: 'the nth smallest value', STDEV: 'standard deviation of a sample', 'STDEV.S': 'standard deviation of a sample', 'STDEV.P': 'standard deviation of a population', CEILING: 'rounds up to a multiple', FLOOR: 'rounds down to a multiple',
  LEFT: 'first characters of text', RIGHT: 'last characters of text', MID: 'characters from the middle of text', LEN: 'length of text', FIND: 'position of text (case-sensitive)', SEARCH: 'position of text (not case-sensitive, allows wildcards)', SUBSTITUTE: 'replaces text by matching', REPLACE: 'replaces text by position', TRIM: 'removes extra spaces', CLEAN: 'removes non-printing characters', UPPER: 'UPPER CASE', LOWER: 'lower case', PROPER: 'Title Case', CONCATENATE: 'joins text', CONCAT: 'joins text and ranges', TEXTJOIN: 'joins text with a separator', TEXT: 'formats a number or date as text', VALUE: 'turns text into a number', REPT: 'repeats text', CHAR: 'character from a code', CODE: 'code of the first character', EXACT: 'case-sensitive equality', TEXTBEFORE: 'text before a delimiter', TEXTAFTER: 'text after a delimiter', TEXTSPLIT: 'splits text into cells', REGEXEXTRACT: 'extracts text matching a pattern', REGEXMATCH: 'tests text against a pattern', REGEXREPLACE: 'replaces text matching a pattern', SPLIT: 'splits text into cells (Sheets)',
  TODAY: 'today’s date', NOW: 'current date and time', DATE: 'builds a date from year, month, day', YEAR: 'year of a date', MONTH: 'month of a date', DAY: 'day of a date', WEEKDAY: 'day of the week as a number', WEEKNUM: 'week number of the year', EDATE: 'date N months away', EOMONTH: 'last day of a month N months away', DATEDIF: 'difference between dates in years, months or days', NETWORKDAYS: 'working days between dates', WORKDAY: 'date N working days away', DAYS: 'days between two dates', HOUR: 'hour of a time', MINUTE: 'minute of a time', TIME: 'builds a time', DATEVALUE: 'turns date text into a date', YEARFRAC: 'fraction of a year between dates',
  ISNUMBER: 'is the value a number?', ISBLANK: 'is the cell empty?', ISTEXT: 'is the value text?', ISERROR: 'is the value an error?', ISNA: 'is the value #N/A?', NA: 'the #N/A error',
  PMT: 'loan payment per period', FV: 'future value of an investment', PV: 'present value', NPV: 'net present value', IRR: 'internal rate of return', RATE: 'interest rate per period',
  QUERY: 'SQL-like query over a range (Sheets)', ARRAYFORMULA: 'applies a formula to a whole range (Sheets)', IMPORTRANGE: 'reads a range from another spreadsheet (Sheets)', GOOGLEFINANCE: 'market data (Sheets)', HYPERLINK: 'a clickable link',
};

/** Lists the functions used in a formula, in order of appearance, with a short description. */
export function explainFormula(f: string): Array<{ name: string; help: string }> {
  const noStrings = f.replace(/"(?:[^"]|"")*"/g, '""');
  const seen = new Set<string>();
  const out: Array<{ name: string; help: string }> = [];
  for (const m of noStrings.matchAll(/([A-Za-z][A-Za-z0-9.]*)\s*\(/g)) {
    const name = m[1].toUpperCase().replace(/^_XLFN\./, '');
    if (seen.has(name)) continue;
    seen.add(name);
    out.push({ name, help: FUNCTION_HELP[name] ?? 'not in the built-in list — check your spreadsheet’s help' });
  }
  return out;
}

/** Quick checks for common typing mistakes in a formula. */
export function checkFormula(f: string): string[] {
  const issues: string[] = [];
  const s = f.trim();
  if (s && !s.startsWith('=')) issues.push('A formula must start with “=”.');
  const quotes = (s.match(/"/g) ?? []).length;
  if (quotes % 2) issues.push('There is an odd number of double quotes — a text value is not closed.');
  const bare = s.replace(/"(?:[^"]|"")*"/g, '""');
  let depth = 0;
  for (const ch of bare) {
    if (ch === '(') depth++;
    else if (ch === ')' && --depth < 0) break;
  }
  if (depth > 0) issues.push(`${depth} opening bracket${depth > 1 ? 's are' : ' is'} not closed.`);
  if (depth < 0) issues.push('There is a closing bracket “)” without an opening one.');
  if (/[“”‘’]/.test(s)) issues.push('Curly quotes (“ ”) are not valid in formulas — use straight quotes (").');
  if (/,\s*\)/.test(bare) && !/IFERROR|XLOOKUP|TEXTAFTER/i.test(bare)) issues.push('An argument is empty before “)” — check for a stray comma.');
  return issues;
}
