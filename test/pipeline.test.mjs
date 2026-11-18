import { test } from 'node:test';
import assert from 'node:assert/strict';
import { planRun, latestPerSource, formatCaption, formatDate } from '../src/pipeline.mjs';
import { validate, DEFAULTS } from '../src/config.mjs';

const sources = [
  { id: 'fb', name: 'Market FB', type: 'facebook', url: 'https://www.facebook.com/x' },
  { id: 'ig', name: 'Market IG', type: 'instagram', url: 'https://www.instagram.com/x/' },
];
const item = (sourceId, code, extra = {}) => ({
  id: `${sourceId}:${code}`, sourceId, code, source: sourceId, channel: 'X', url: `https://x/${code}`, image: 'i', date: '', ...extra,
});

test('first read of a source only registers a baseline (nothing is sent)', () => {
  const plan = planRun([item('fb', '1'), item('fb', '2')], { seen: [], initializedSources: [] }, sources);
  assert.equal(plan.fresh.length, 0);
  assert.deepEqual(plan.silentlySeen, ['fb:1', 'fb:2']);
  assert.deepEqual(plan.newlyInitialized, ['fb']);
});

test('after the baseline only unseen items are sent, oldest first', () => {
  const state = { seen: ['fb:1'], initializedSources: ['fb'] };
  const plan = planRun([item('fb', '3'), item('fb', '2'), item('fb', '1')], state, sources);
  assert.deepEqual(plan.fresh.map((i) => i.code), ['2', '3']);
  assert.deepEqual(plan.newlyInitialized, []);
});

test('a new source added later gets its own baseline without flooding', () => {
  const state = { seen: ['fb:1'], initializedSources: ['fb'] };
  const plan = planRun([item('fb', '1'), item('ig', 'A')], state, sources);
  assert.equal(plan.fresh.length, 0);
  assert.deepEqual(plan.silentlySeen, ['ig:A']);
  assert.deepEqual(plan.newlyInitialized, ['ig']);
});

test('a source that returned nothing is not marked as initialized', () => {
  const plan = planRun([], { seen: [], initializedSources: [] }, sources);
  assert.deepEqual(plan.newlyInitialized, []);
});

test('latestPerSource: Facebook = all photos of the newest post; Instagram = newest by date', () => {
  const items = [
    item('fb', '100', { url: 'https://post/A' }),
    item('fb', '300', { url: 'https://post/B' }),
    item('fb', '301', { url: 'https://post/B' }),
    item('ig', 'old', { date: '2026-11-01T10:00:00Z' }),
    item('ig', 'new', { date: '2026-11-16T10:00:00Z' }),
  ];
  const picked = latestPerSource(items, sources);
  assert.deepEqual(picked.map((i) => i.id), ['fb:300', 'fb:301', 'ig:new']);
});

test('formatCaption fills placeholders and formats ISO dates in the configured timezone', () => {
  const cfg = { ...DEFAULTS, timezone: 'America/Sao_Paulo', browser: { ...DEFAULTS.browser, locale: 'pt-BR' } };
  const caption = formatCaption('{source} | {date} | {url}', item('fb', '1', { source: 'Mercado', date: '2026-11-17T22:00:00.000Z' }), cfg);
  assert.match(caption, /^Mercado \| 17\/11\/2026.*19:00 \| https:\/\/x\/1$/);
  assert.equal(formatDate('Segunda, 16 de novembro de 2026 às 08:57', cfg), 'Segunda, 16 de novembro de 2026 às 08:57');
});

test('config validation rejects bad sources', () => {
  assert.throws(() => validate({ sources: [] }), /non-empty/);
  assert.throws(() => validate({ sources: [{ id: 'a:b', type: 'facebook', url: 'https://x' }] }), /Invalid source id/);
  assert.throws(() => validate({ sources: [{ id: 'a', type: 'tiktok', url: 'https://x' }] }), /type must be/);
  assert.throws(() => validate({ sources: [{ id: 'a', type: 'facebook', url: 'http://x' }] }), /https/);
  assert.throws(() => validate({ sources: [{ id: 'a', type: 'facebook', url: 'https://x' }, { id: 'a', type: 'facebook', url: 'https://y' }] }), /Duplicate/);
});
