/** Settings (your defaults) and run history, kept only in this browser. */
import { DEFAULT_BULLET_BANK, DEFAULT_CERTS, DEFAULT_SKILL_BANK, DEFAULT_SUMMARY, DEFAULT_TEX } from './defaults';
import type { BulletReport, TailorSettings } from './engine';

const SETTINGS_KEY = 'usamaverse:v1:tailor-settings';
const HISTORY_KEY = 'usamaverse:v1:tailor-history';
export const HISTORY_MAX = 40;

export const defaultSettings = (): TailorSettings => ({
  baseTex: DEFAULT_TEX,
  bulletBank: DEFAULT_BULLET_BANK,
  skillBank: DEFAULT_SKILL_BANK,
  certs: DEFAULT_CERTS,
  certCount: 3,
  summaryTemplate: DEFAULT_SUMMARY,
  years: '4',
  headline: 'Data Analyst',
  rewriteSummary: true,
  reorderBullets: true,
  useBank: true,
  reorderSkills: true,
  addSkills: true,
  addCerts: true,
  replaceHeadline: true,
  minChars: 140,
  maxChars: 190,
});

export function normaliseSettings(x: unknown): TailorSettings {
  const d = defaultSettings();
  if (!x || typeof x !== 'object') return d;
  const o = x as Record<string, unknown>;
  const out = { ...d };
  for (const k of Object.keys(d) as Array<keyof TailorSettings>) {
    const v = o[k];
    if (typeof v === typeof d[k]) (out as Record<string, unknown>)[k] = v;
  }
  out.certCount = Math.min(5, Math.max(1, Math.round(out.certCount)));
  out.minChars = Math.max(20, Math.round(out.minChars));
  out.maxChars = Math.max(out.minChars + 10, Math.round(out.maxChars));
  return out;
}

export function loadSettings(): { settings: TailorSettings; saved: boolean } {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (raw) return { settings: normaliseSettings(JSON.parse(raw)), saved: true };
  } catch {
    /* storage blocked or corrupt */
  }
  return { settings: defaultSettings(), saved: false };
}

export function saveSettings(s: TailorSettings): boolean {
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(s));
    return true;
  } catch {
    return false;
  }
}

export function resetSettings() {
  try {
    localStorage.removeItem(SETTINGS_KEY);
  } catch {
    /* blocked */
  }
}

export interface RunRecord {
  id: string;
  at: string; // ISO time
  role: string;
  company: string;
  jd: string;
  tex: string;
  scoreBefore: number;
  scoreAfter: number;
  missing: string[];
  changes: string[];
  warnings: string[];
  bullets: BulletReport[];
  certsUsed: string[];
  durationMs: number;
}

export function loadHistory(): RunRecord[] {
  try {
    const raw = localStorage.getItem(HISTORY_KEY);
    const arr = raw ? (JSON.parse(raw) as unknown) : [];
    return Array.isArray(arr) ? (arr.filter((r) => r && typeof r === 'object' && typeof (r as RunRecord).tex === 'string') as RunRecord[]) : [];
  } catch {
    return [];
  }
}

/** Saves newest first; drops the oldest runs if the browser's storage is full. */
export function saveHistory(list: RunRecord[]): { saved: boolean; kept: number } {
  let keep = list.slice(0, HISTORY_MAX);
  while (keep.length) {
    try {
      localStorage.setItem(HISTORY_KEY, JSON.stringify(keep));
      return { saved: true, kept: keep.length };
    } catch {
      keep = keep.slice(0, Math.max(0, keep.length - 3));
    }
  }
  try {
    localStorage.removeItem(HISTORY_KEY);
  } catch {
    /* blocked */
  }
  return { saved: false, kept: 0 };
}

export const runId = () => `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;

export function fileStemFor(r: Pick<RunRecord, 'role' | 'company'>): string {
  const s = `${r.role} ${r.company}`
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
  return `resume-${s || 'tailored'}`;
}
