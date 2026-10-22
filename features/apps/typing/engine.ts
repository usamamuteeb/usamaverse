export type TypingMode = 'time' | 'words' | 'quote' | 'custom';
export type QuoteLength = 'short' | 'medium' | 'long';
export type RunStatus = 'ready' | 'running' | 'completed' | 'aborted';

export interface TypingConfig {
  mode: TypingMode;
  seconds: number;
  wordCount: number;
  quoteLength: QuoteLength;
  customText: string;
  punctuation: boolean;
  numbers: boolean;
  language: 'en';
}

export const defaultConfig: TypingConfig = {
  mode: 'time', seconds: 30, wordCount: 25, quoteLength: 'short',
  customText: '', punctuation: false, numbers: false, language: 'en',
};

export interface KeystrokeSample { at: number; correct: boolean }

export interface TypingSession {
  status: RunStatus;
  config: TypingConfig;
  target: string[];
  typed: string[];
  startedAt: number | null;
  endedAt: number | null;
  attempts: number;
  correctAttempts: number;
  wrongAttempts: number;
  backspaces: number;
  interrupted: boolean;
  samples: KeystrokeSample[];
}

export interface TypingResult {
  status: 'completed' | 'aborted';
  config: TypingConfig;
  durationSeconds: number;
  wpm: number | null;
  rawWpm: number | null;
  accuracy: number | null;
  attempts: number;
  correctAttempts: number;
  wrongAttempts: number;
  backspaces: number;
  positional: { correct: number; incorrect: number; extra: number; missed: number };
  interrupted: boolean;
  eligibleForBest: boolean;
  samples: KeystrokeSample[];
}

const segmenter = typeof Intl.Segmenter === 'function' ? new Intl.Segmenter('en', { granularity: 'grapheme' }) : null;
export function graphemes(value: string): string[] {
  return segmenter ? Array.from(segmenter.segment(value), (part) => part.segment) : Array.from(value);
}

export function createSession(config: TypingConfig, target: string): TypingSession {
  return {
    status: 'ready', config: { ...config }, target: graphemes(target), typed: [],
    startedAt: null, endedAt: null, attempts: 0, correctAttempts: 0,
    wrongAttempts: 0, backspaces: 0, interrupted: false, samples: [],
  };
}

function finish(session: TypingSession, now: number, status: 'completed' | 'aborted'): TypingSession {
  if (session.status !== 'running') return session;
  return { ...session, status, endedAt: now };
}

export function tick(session: TypingSession, now: number): TypingSession {
  if (session.status !== 'running' || session.config.mode !== 'time' || session.startedAt === null) return session;
  const deadline = session.startedAt + session.config.seconds * 1000;
  return now >= deadline ? finish(session, deadline, 'completed') : session;
}

export function commitText(session: TypingSession, input: string, now: number): TypingSession {
  let current = tick(session, now);
  if (current.status === 'completed' || current.status === 'aborted') return current;
  const units = graphemes(input).filter((unit) => unit === '\n' || (!/[\u0000-\u001f\u007f]/u.test(unit) && unit !== '\t'));
  if (units.length === 0 || current.target.length === 0) return current;
  if (current.status === 'ready') current = { ...current, status: 'running', startedAt: now };
  const typed = [...current.typed];
  const samples = [...current.samples];
  let attempts = current.attempts;
  let correctAttempts = current.correctAttempts;
  let wrongAttempts = current.wrongAttempts;
  for (const unit of units) {
    if (current.config.mode !== 'time' && typed.length >= current.target.length) break;
    const correct = unit === current.target[typed.length];
    typed.push(unit);
    attempts += 1;
    if (correct) correctAttempts += 1;
    else wrongAttempts += 1;
    samples.push({ at: (now - current.startedAt!) / 1000, correct });
    if (current.config.mode !== 'time' && typed.length === current.target.length) break;
  }
  current = { ...current, typed, samples, attempts, correctAttempts, wrongAttempts };
  if (current.config.mode !== 'time' && typed.length >= current.target.length) return finish(current, now, 'completed');
  return current;
}

export function backspace(session: TypingSession, now: number): TypingSession {
  const current = tick(session, now);
  if (current.status !== 'running' || current.typed.length === 0) return current;
  return { ...current, typed: current.typed.slice(0, -1), backspaces: current.backspaces + 1 };
}

export function interrupt(session: TypingSession): TypingSession {
  return session.status === 'running' && !session.interrupted ? { ...session, interrupted: true } : session;
}

export function abort(session: TypingSession, now: number): TypingSession {
  return finish(tick(session, now), now, 'aborted');
}

export function getResult(session: TypingSession): TypingResult | null {
  if ((session.status !== 'completed' && session.status !== 'aborted') || session.startedAt === null || session.endedAt === null) return null;
  const durationSeconds = Math.max(0, (session.endedAt - session.startedAt) / 1000);
  const hasScore = session.attempts > 0 && durationSeconds >= 1;
  let correct = 0, incorrect = 0, extra = 0;
  session.typed.forEach((unit, index) => {
    if (index >= session.target.length) extra += 1;
    else if (unit === session.target[index]) correct += 1;
    else incorrect += 1;
  });
  return {
    status: session.status, config: { ...session.config }, durationSeconds,
    wpm: hasScore ? session.correctAttempts * 12 / durationSeconds : null,
    rawWpm: hasScore ? session.attempts * 12 / durationSeconds : null,
    accuracy: hasScore ? session.correctAttempts / session.attempts * 100 : null,
    attempts: session.attempts, correctAttempts: session.correctAttempts,
    wrongAttempts: session.wrongAttempts, backspaces: session.backspaces,
    positional: { correct, incorrect, extra, missed: Math.max(0, session.target.length - session.typed.length) },
    interrupted: session.interrupted,
    eligibleForBest: session.status === 'completed' && !session.interrupted && hasScore && session.config.mode !== 'custom',
    samples: [...session.samples],
  };
}

export function bestKey(config: TypingConfig): string {
  const length = config.mode === 'time' ? config.seconds : config.mode === 'words' ? config.wordCount : config.mode === 'quote' ? config.quoteLength : 'custom';
  return [config.mode, length, config.language, config.punctuation ? 'punctuation' : 'plain', config.numbers ? 'numbers' : 'letters'].join(':');
}

export function chartBuckets(samples: KeystrokeSample[], durationSeconds: number): Array<{ second: number; spanSeconds: number; correct: number; wrong: number; wpm: number }> {
  const spanSeconds = Math.max(1, Math.ceil(durationSeconds / 180));
  const total = Math.max(1, Math.ceil(durationSeconds / spanSeconds));
  const buckets = Array.from({ length: total }, (_, index) => ({
    second: Math.min(durationSeconds, (index + 1) * spanSeconds),
    spanSeconds: Math.max(0.001, Math.min(spanSeconds, durationSeconds - index * spanSeconds)),
    correct: 0, wrong: 0, wpm: 0,
  }));
  for (const sample of samples) {
    const index = Math.min(total - 1, Math.max(0, Math.ceil(sample.at / spanSeconds) - 1));
    if (sample.correct) buckets[index].correct += 1;
    else buckets[index].wrong += 1;
  }
  for (const bucket of buckets) bucket.wpm = bucket.correct * 12 / bucket.spanSeconds;
  return buckets;
}
