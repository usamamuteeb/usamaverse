'use client';

import { useSyncExternalStore } from 'react';

/**
 * Browser-local, versioned, clearable lists (favorites / recent).
 * Never synced anywhere. Every storage access is wrapped because storage can
 * be blocked (private windows, strict settings).
 */
const PREFIX = 'usamaverse:v1:';
export const STORE_KEYS = { favorites: `${PREFIX}favorites`, recent: `${PREFIX}recent` } as const;
type StoreKey = (typeof STORE_KEYS)[keyof typeof STORE_KEYS];

const EMPTY: string[] = [];
const cache = new Map<StoreKey, string[]>();
const listeners = new Map<StoreKey, Set<() => void>>();

function read(key: StoreKey): string[] {
  const hit = cache.get(key);
  if (hit) return hit;
  let value: string[] = EMPTY;
  try {
    const raw = window.localStorage.getItem(key);
    if (raw) {
      const parsed: unknown = JSON.parse(raw);
      if (Array.isArray(parsed)) value = parsed.filter((x): x is string => typeof x === 'string').slice(0, 200);
    }
  } catch {
    value = EMPTY;
  }
  cache.set(key, value);
  return value;
}

function emit(key: StoreKey) {
  listeners.get(key)?.forEach((fn) => fn());
}

function write(key: StoreKey, value: string[]) {
  cache.set(key, value);
  try {
    if (value.length === 0) window.localStorage.removeItem(key);
    else window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* storage blocked: keep the in-memory value for this visit */
  }
  emit(key);
}

let storageListenerAttached = false;
function subscribe(key: StoreKey, fn: () => void) {
  if (!listeners.has(key)) listeners.set(key, new Set());
  listeners.get(key)!.add(fn);
  if (!storageListenerAttached && typeof window !== 'undefined') {
    storageListenerAttached = true;
    window.addEventListener('storage', (e) => {
      const k = e.key as StoreKey | null;
      if (k && listeners.has(k)) {
        cache.delete(k);
        emit(k);
      }
    });
  }
  return () => listeners.get(key)?.delete(fn);
}

function useList(key: StoreKey): string[] {
  return useSyncExternalStore(
    (fn) => subscribe(key, fn),
    () => read(key),
    () => EMPTY,
  );
}

export function useFavorites() {
  const list = useList(STORE_KEYS.favorites);
  return {
    favorites: list,
    isFavorite: (slug: string) => list.includes(slug),
    toggle: (slug: string) => {
      const cur = read(STORE_KEYS.favorites);
      write(STORE_KEYS.favorites, cur.includes(slug) ? cur.filter((s) => s !== slug) : [slug, ...cur]);
    },
    clear: () => write(STORE_KEYS.favorites, []),
  };
}

const RECENT_MAX = 12;

export function useRecent() {
  const list = useList(STORE_KEYS.recent);
  return {
    recent: list,
    clear: () => write(STORE_KEYS.recent, []),
  };
}

export function recordRecent(slug: string) {
  if (typeof window === 'undefined') return;
  const cur = read(STORE_KEYS.recent);
  if (cur[0] === slug) return;
  write(STORE_KEYS.recent, [slug, ...cur.filter((s) => s !== slug)].slice(0, RECENT_MAX));
}

export function clearAllLocalData() {
  write(STORE_KEYS.favorites, []);
  write(STORE_KEYS.recent, []);
  try {
    // Everything this site stores uses the same prefix: remove it all
    // (effects, checklist, CV draft, Resume Tailor setup and history, invoice details…).
    const keys: string[] = [];
    for (let i = 0; i < window.localStorage.length; i++) {
      const k = window.localStorage.key(i);
      if (k && k.startsWith(PREFIX)) keys.push(k);
    }
    keys.forEach((k) => window.localStorage.removeItem(k));
  } catch {
    /* ignore */
  }
}
