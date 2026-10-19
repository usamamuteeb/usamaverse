/**
 * Runs user regular expressions off the main thread. The page terminates this
 * worker if it takes too long, so catastrophic backtracking can't freeze the UI.
 */
export interface RegexRequest {
  id: number;
  pattern: string;
  flags: string;
  text: string;
  replacement: string | null;
  maxMatches: number;
}

export interface RegexMatch {
  index: number;
  text: string;
  groups: Array<string | undefined>;
  named: Record<string, string | undefined> | null;
}

export type RegexResponse =
  | { id: number; ok: true; matches: RegexMatch[]; total: number; truncated: boolean; replaced: string | null }
  | { id: number; ok: false; error: string };

self.onmessage = (e: MessageEvent<RegexRequest>) => {
  const { id, pattern, flags, text, replacement, maxMatches } = e.data;
  try {
    const global = flags.includes('g');
    const re = new RegExp(pattern, global ? flags : flags + 'g');
    const matches: RegexMatch[] = [];
    let total = 0;
    for (const m of text.matchAll(re)) {
      total++;
      if (matches.length < maxMatches) matches.push({ index: m.index ?? 0, text: m[0], groups: m.slice(1), named: m.groups ? { ...m.groups } : null });
      if (!global) break;
      if (total >= 100_000) break;
    }
    const replaced = replacement === null ? null : text.replace(new RegExp(pattern, flags), replacement);
    const res: RegexResponse = { id, ok: true, matches, total, truncated: total > matches.length, replaced };
    (self as unknown as Worker).postMessage(res);
  } catch (err) {
    const res: RegexResponse = { id, ok: false, error: err instanceof Error ? err.message : String(err) };
    (self as unknown as Worker).postMessage(res);
  }
};
