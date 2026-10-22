import { bestKey, type TypingConfig, type TypingResult } from './engine';
import { safeConfig } from './content';

const SETTINGS_KEY = 'usamaverse:typing:settings:v1';
const DB_NAME = 'usamaverse-typing';
const STORE = 'results';
const MAX_RESULTS = 500;

export interface HistoryEntry {
  id: string;
  at: number;
  key: string;
  mode: TypingConfig['mode'];
  length: string;
  language: 'en';
  wpm: number | null;
  rawWpm: number | null;
  accuracy: number | null;
  durationSeconds: number;
  attempts: number;
  correct: number;
  wrong: number;
  interrupted: boolean;
}

export function loadSettings(): TypingConfig {
  try { return safeConfig(JSON.parse(localStorage.getItem(SETTINGS_KEY) ?? '{}')); }
  catch { return safeConfig(null); }
}

export function saveSettings(config: TypingConfig): boolean {
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify({ ...config, customText: '' }));
    return true;
  } catch { return false; }
}

export function clearTypingSettings(): void {
  try { localStorage.removeItem(SETTINGS_KEY); } catch { /* blocked storage */ }
}

export function makeEntry(result: TypingResult): HistoryEntry {
  const config = result.config;
  const length = config.mode === 'time' ? `${config.seconds}s` : config.mode === 'words' ? `${config.wordCount} words` : config.mode === 'quote' ? `${config.quoteLength} quote` : 'custom text';
  return {
    id: crypto.randomUUID(), at: Date.now(), key: bestKey(config), mode: config.mode,
    length, language: 'en', wpm: result.wpm, rawWpm: result.rawWpm,
    accuracy: result.accuracy, durationSeconds: result.durationSeconds,
    attempts: result.attempts, correct: result.correctAttempts,
    wrong: result.wrongAttempts, interrupted: result.interrupted,
  };
}

export function isHistoryEntry(value: unknown): value is HistoryEntry {
  if (!value || typeof value !== 'object') return false;
  const x = value as Record<string, unknown>;
  return typeof x.id === 'string' && x.id.length > 0 && x.id.length < 100 &&
    typeof x.at === 'number' && Number.isFinite(x.at) && x.at > 0 &&
    typeof x.key === 'string' && x.key.length < 200 &&
    ['time', 'words', 'quote', 'custom'].includes(String(x.mode)) &&
    typeof x.length === 'string' && x.length.length < 100 && x.language === 'en' &&
    ['wpm', 'rawWpm', 'accuracy'].every((key) => x[key] === null || (typeof x[key] === 'number' && Number.isFinite(x[key]) && (x[key] as number) >= 0 && (x[key] as number) <= 10000)) &&
    typeof x.durationSeconds === 'number' && Number.isFinite(x.durationSeconds) && x.durationSeconds >= 0 && x.durationSeconds <= 3600 &&
    ['attempts', 'correct', 'wrong'].every((key) => Number.isInteger(x[key]) && (x[key] as number) >= 0 && (x[key] as number) <= 100000) &&
    typeof x.interrupted === 'boolean';
}

export function parseHistoryImport(value: unknown): HistoryEntry[] {
  if (!value || typeof value !== 'object') throw new Error('Invalid history file.');
  const x = value as { version?: unknown; entries?: unknown };
  if (x.version !== 1 || !Array.isArray(x.entries) || x.entries.length > MAX_RESULTS) throw new Error('Expected a version 1 export with up to 500 results.');
  if (!x.entries.every(isHistoryEntry)) throw new Error('The file contains an invalid result.');
  return x.entries;
}

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') { reject(new Error('Local history is unavailable in this browser.')); return; }
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE, { keyPath: 'id' });
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('Could not open local history.'));
    request.onblocked = () => reject(new Error('Close other tabs of this site and try again.'));
  });
}

async function transaction<T>(mode: IDBTransactionMode, work: (store: IDBObjectStore, resolve: (value: T) => void, reject: (reason: unknown) => void) => void): Promise<T> {
  const db = await openDatabase();
  return new Promise<T>((resolve, reject) => {
    const tx = db.transaction(STORE, mode);
    const store = tx.objectStore(STORE);
    let value: T;
    let done = false;
    const good = (next: T) => { value = next; done = true; };
    tx.oncomplete = () => { db.close(); if (done) resolve(value); else reject(new Error('History operation did not finish.')); };
    tx.onerror = () => { db.close(); reject(tx.error ?? new Error('Local history failed.')); };
    tx.onabort = () => { db.close(); reject(tx.error ?? new Error('Local history was interrupted.')); };
    try { work(store, good, reject); } catch (error) { tx.abort(); reject(error); }
  });
}

export async function listHistory(): Promise<HistoryEntry[]> {
  return transaction('readonly', (store, resolve, reject) => {
    const request = store.getAll();
    request.onsuccess = () => resolve((request.result as unknown[]).filter(isHistoryEntry).sort((a, b) => b.at - a.at));
    request.onerror = () => reject(request.error);
  });
}

export async function addHistory(entry: HistoryEntry): Promise<void> {
  if (!isHistoryEntry(entry)) throw new Error('Invalid result.');
  return transaction('readwrite', (store, resolve, reject) => {
    const all = store.getAll();
    all.onsuccess = () => {
      const entries = (all.result as HistoryEntry[]).filter(isHistoryEntry).concat(entry).sort((a, b) => b.at - a.at);
      for (const old of entries.slice(MAX_RESULTS)) store.delete(old.id);
      store.put(entry);
      resolve();
    };
    all.onerror = () => reject(all.error);
  });
}

export async function mergeHistory(entries: HistoryEntry[]): Promise<void> {
  if (entries.length > MAX_RESULTS || !entries.every(isHistoryEntry)) throw new Error('Invalid history import.');
  return transaction('readwrite', (store, resolve, reject) => {
    const all = store.getAll();
    all.onsuccess = () => {
      const byId = new Map<string, HistoryEntry>();
      for (const entry of (all.result as unknown[]).filter(isHistoryEntry)) byId.set(entry.id, entry);
      for (const entry of entries) byId.set(entry.id, entry);
      const keep = new Set([...byId.values()].sort((a, b) => b.at - a.at).slice(0, MAX_RESULTS).map((entry) => entry.id));
      for (const entry of byId.values()) {
        if (keep.has(entry.id)) store.put(entry);
        else store.delete(entry.id);
      }
      resolve();
    };
    all.onerror = () => reject(all.error);
  });
}

export async function clearHistory(): Promise<void> {
  return transaction('readwrite', (store, resolve) => { store.clear(); resolve(); });
}
