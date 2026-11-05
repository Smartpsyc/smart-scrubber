import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { createCase, scrub, buildGuard, findLeaks, sha256Hex } from '../src/index.js';

test('sha256 matches node:crypto', () => {
  for (const s of ['', 'a', 'נועה כהן', '🙂 emoji', 'x'.repeat(1000), 'y'.repeat(55), 'z'.repeat(64)]) {
    assert.equal(sha256Hex(s), createHash('sha256').update(s).digest('hex'));
  }
});

const kase = scrub('ת.ז. 123456782, 054-1234567, rachel@example.com', createCase({ seed: 'g', entities: [
  { kind: 'person', gender: 'f', first: { he: 'נועה', en: 'Noa' }, last: { he: 'כהן', en: 'Cohen' } },
  { kind: 'town', he: 'קריית אונו', en: 'Kiryat Ono' },
] })).case;
const guard = buildGuard([kase], 'guard-salt-0123456789');
const labels = (body) => findLeaks(body, guard, { patterns: false }).map((x) => x.label).sort();

test('guard holds no plaintext identifiers', () => {
  const s = JSON.stringify(guard);
  for (const w of ['נועה', 'Noa', 'כהן', 'Cohen', 'אונו', '123456782', '0541234567', 'rachel']) assert.ok(!s.includes(w), w);
});

test('catches prefixed, possessive, multi-word and cased forms', () => {
  assert.deepEqual(labels('וכשלנועה קשה'), ['e1.first']);
  assert.deepEqual(labels("NOA's file"), ['e1.first']);
  assert.deepEqual(labels('גרים בקריית אונו'), ['e2.name']);
  assert.deepEqual(labels('moved from kiryat ono'), ['e2.name']);
});

test('catches identifiers inside JSON, including \\u escapes', () => {
  const body = JSON.stringify({ prompt: 'hi', attachments: [], text: 'נועה' }).replace('נועה', '\\u05e0\\u05d5\\u05e2\\u05d4');
  assert.deepEqual(labels(body), ['e1.first']);
});

test('catches redacted numbers and emails in other formats', () => {
  assert.deepEqual(labels('call +972 54 123 4567'), ['phone']);
  assert.deepEqual(labels('id 123456782'), ['id']);
  assert.deepEqual(labels('RACHEL@EXAMPLE.COM'), ['email']);
});

test('pattern mode flags undeclared IDs/phones/emails page-side', () => {
  const f = findLeaks('ת.ז. 000000018', guard).map((x) => x.label);
  assert.ok(f.includes('pattern:id'));
});

test('salt changes every hash', () => {
  const g2 = buildGuard([kase], 'another-salt-987654321');
  const a = new Set(Object.keys(guard.hashes));
  assert.ok(Object.keys(g2.hashes).every((h) => !a.has(h)));
  assert.throws(() => buildGuard([kase], 'short'));
});

test('clean text passes', () => {
  assert.deepEqual(findLeaks('הילדה הגיעה עם אמה. Scores: 85, 7/10.', guard), []);
});
