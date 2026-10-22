import assert from 'node:assert/strict';
import test from 'node:test';
import {
  backspace, bestKey, chartBuckets, commitText, createSession, defaultConfig,
  getResult, graphemes, interrupt, tick,
} from '../features/apps/typing/engine';
import { buildPrompt, safeConfig, validateConfig } from '../features/apps/typing/content';
import { isHistoryEntry, parseHistoryImport } from '../features/apps/typing/storage';

test('first committed input starts time, empty/modifier input does not', () => {
  const ready = createSession(defaultConfig, 'hello world');
  assert.equal(commitText(ready, '', 500).status, 'ready');
  assert.equal(commitText(ready, '\t', 500).status, 'ready');
  const running = commitText(ready, 'h', 1000);
  assert.equal(running.status, 'running');
  assert.equal(running.startedAt, 1000);
});

test('25 correct characters over 30 seconds is 10 WPM', () => {
  const ready = createSession(defaultConfig, 'a'.repeat(25));
  const running = commitText(ready, 'a'.repeat(25), 1000);
  const finished = tick(running, 31000);
  const result = getResult(finished)!;
  assert.equal(finished.endedAt, 31000);
  assert.equal(result.wpm, 10);
  assert.equal(result.rawWpm, 10);
  assert.equal(result.accuracy, 100);
  assert.equal(result.positional.correct, 25);
});

test('deadline rejects later characters and result freezes once', () => {
  const config = { ...defaultConfig, seconds: 15 };
  const running = commitText(createSession(config, 'abc'), 'a', 200);
  const finished = commitText(running, 'b', 15200);
  assert.equal(finished.status, 'completed');
  assert.equal(finished.endedAt, 15200);
  assert.equal(finished.typed.join(''), 'a');
  assert.equal(commitText(finished, 'c', 16000), finished);
});

test('backspace changes visible text but historical mistake stays in accuracy', () => {
  const config = { ...defaultConfig, mode: 'words' as const };
  let state = commitText(createSession(config, 'ab'), 'x', 1000);
  state = backspace(state, 1500);
  assert.equal(state.typed.length, 0);
  state = commitText(state, 'ab', 3000);
  const result = getResult(state)!;
  assert.equal(result.status, 'completed');
  assert.equal(result.attempts, 3);
  assert.equal(result.correctAttempts, 2);
  assert.equal(result.wrongAttempts, 1);
  assert.equal(result.accuracy, 2 / 3 * 100);
  assert.deepEqual(result.positional, { correct: 2, incorrect: 0, extra: 0, missed: 0 });
});

test('word and custom tests finish on the final target grapheme, once', () => {
  const config = { ...defaultConfig, mode: 'words' as const };
  const state = commitText(createSession(config, 'cat'), 'catmore', 0);
  assert.equal(state.status, 'completed');
  assert.equal(state.typed.join(''), 'cat');
  assert.equal(commitText(state, 'z', 100), state);
});

test('Unicode graphemes and committed composition text are single attempts', () => {
  assert.deepEqual(graphemes('e\u0301👩🏽‍💻'), ['e\u0301', '👩🏽‍💻']);
  const config = { ...defaultConfig, mode: 'custom' as const };
  const state = commitText(createSession(config, 'e\u0301👩🏽‍💻'), 'e\u0301👩🏽‍💻', 0);
  assert.equal(state.status, 'completed');
  assert.equal(state.attempts, 2);
});

test('an interrupted run keeps time and is not eligible for personal best', () => {
  const running = commitText(createSession(defaultConfig, 'abc'), 'a', 0);
  const finished = tick(interrupt(running), 30000);
  assert.equal(getResult(finished)?.eligibleForBest, false);
});

test('empty and subsecond attempts have no score, no Infinity', () => {
  const config = { ...defaultConfig, mode: 'words' as const };
  const result = getResult(commitText(createSession(config, 'a'), 'a', 0))!;
  assert.equal(result.wpm, null);
  assert.equal(result.accuracy, null);
});

test('chart includes idle seconds and bests separate unlike configurations', () => {
  assert.deepEqual(chartBuckets([{ at: 0, correct: true }, { at: 3, correct: false }], 3).map((item) => item.wpm), [12, 0, 0]);
  assert.notEqual(bestKey(defaultConfig), bestKey({ ...defaultConfig, seconds: 60 }));
  assert.notEqual(bestKey(defaultConfig), bestKey({ ...defaultConfig, punctuation: true }));
});

test('original prompts are deterministic, sized and custom input is validated', () => {
  assert.equal(buildPrompt({ ...defaultConfig, mode: 'words', wordCount: 25 }, 42).split(' ').length, 25);
  assert.equal(buildPrompt(defaultConfig, 42), buildPrompt(defaultConfig, 42));
  assert.equal(validateConfig({ ...defaultConfig, mode: 'custom', customText: '' }), 'Enter 2 to 5,000 characters of custom text.');
  assert.equal(safeConfig({ seconds: 999 }).seconds, 30);
});

test('history import accepts only versioned valid summary records', () => {
  const entry = { id: 'a', at: 1000, key: 'time:30:en:plain:letters', mode: 'time', length: '30s', language: 'en', wpm: 40, rawWpm: 42, accuracy: 95, durationSeconds: 30, attempts: 100, correct: 95, wrong: 5, interrupted: false };
  assert.equal(isHistoryEntry(entry), true);
  assert.deepEqual(parseHistoryImport({ version: 1, entries: [entry] }), [entry]);
  assert.throws(() => parseHistoryImport({ version: 1, entries: [{ ...entry, wpm: Infinity }] }));
  assert.throws(() => parseHistoryImport({ version: 2, entries: [] }));
});
