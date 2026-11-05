// Restore against text Claude might plausibly write back: new prefixes,
// a different language, reformatted dates, tokens.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createCase, scrub, restore } from '../src/index.js';

function setup(extra = []) {
  let kase = createCase({ seed: 'restore-seed', dateOffsetDays: -147, entities: [
    { kind: 'person', role: 'client', gender: 'f', first: { he: 'נועה', en: 'Noa' }, last: { he: 'כהן', en: 'Cohen' }, nicknames: [{ he: 'נועי', en: 'Noy' }] },
    { kind: 'person', role: 'father', gender: 'm', first: { he: 'אבי' } },
    { kind: 'town', he: 'קריית אונו', en: 'Kiryat Ono' },
    ...extra,
  ] });
  const r = scrub('נועה כהן (נועי) מקריית אונו, אביה אבי. נבדקה ב-12/03/2024, טלפון 054-123-4567.', kase);
  kase = r.case;
  const sur = (entity, part) => kase.mappings.find((m) => m.entityId === entity && m.part === part).sur;
  return { kase, r, sur };
}

test('Hebrew reply with new prefixes restores', () => {
  const { kase, sur } = setup();
  const s = sur('e1', 'first').he;
  const reply = `כש${s} מגיעה, ול${s} קשה. וכש${s} עייפה – ל-${s} יש הפסקה.`;
  assert.equal(restore(reply, kase).text, 'כשנועה מגיעה, ולנועה קשה. וכשנועה עייפה – ל-נועה יש הפסקה.');
});

test('English reply restores Hebrew-declared names into their English spelling', () => {
  const { kase, sur } = setup();
  const s = sur('e1', 'first').en;
  const last = sur('e1', 'last').en;
  const town = sur('e3', 'name').en;
  const reply = `${s} ${last}'s profile suggests... ${s.toUpperCase()} lives in ${town}.`;
  assert.equal(restore(reply, kase).text, "Noa Cohen's profile suggests... NOA lives in Kiryat Ono.");
});

test('no English spelling declared → falls back to the Hebrew form', () => {
  const { kase, sur } = setup();
  const dad = sur('e2', 'first');
  assert.equal(restore(`Her father ${dad.en} attended.`, kase).text, 'Her father אבי attended.');
  // English real inside Hebrew text after a prefix gets a hyphen: "ל-Noa"
  const k2 = createCase({ seed: 'x', entities: [{ kind: 'person', gender: 'f', first: { en: 'Emily' } }] });
  const r2 = scrub('Emily came.', k2);
  const s2 = r2.case.mappings[0].sur.he;
  assert.equal(restore(`ל${s2} יש קושי`, r2.case).text, 'ל-Emily יש קושי');
});

test('nickname surrogate restores to the nickname', () => {
  const { kase, sur } = setup();
  const nick = sur('e1', 'nick0');
  assert.notEqual(nick.he, sur('e1', 'first').he);
  assert.equal(restore(`${nick.he} ו${nick.en}`, kase).text, 'נועי וNoy');
});

test('redaction tokens restore in either language; unknown tokens are reported', () => {
  const { kase } = setup();
  assert.equal(restore('Call [PHONE 1] or [טלפון 1].', kase).text, 'Call 054-123-4567 or 054-123-4567.');
  const r = restore('See [ID 7].', kase);
  assert.equal(r.text, 'See [ID 7].');
  assert.deepEqual(r.unresolved, ['[ID 7]']);
});

test('dates: exact shifted string and reformatted restatements', () => {
  const { kase, r } = setup();
  // 12/03/2024 − 147 days = 17/10/2023 (both Tuesdays)
  assert.ok(r.text.includes('17/10/2023'), r.text);
  assert.equal(restore('ב-17/10/2023', kase).text, 'ב-12/03/2024');
  assert.equal(restore('On October 17, 2023 she...', kase).text, 'On March 12, 2024 she...');
  assert.equal(restore('ב-17 באוקטובר 2023', kase).text, 'ב-12 במרץ 2024');
  assert.equal(restore('since October 2023', kase).text, 'since March 2024');
  assert.equal(restore('2023-10-17', kase).text, '2024-03-12');
  // A date Claude invents that the case never produced is left alone.
  assert.equal(restore('DSM-5 (May 18, 2013)', kase).text, 'DSM-5 (May 18, 2013)');
});

test('restore never touches the real names or unrelated words', () => {
  const { kase } = setup();
  const text = 'נועה כהן already real. אביגיל unrelated? Shalom.';
  const out = restore(text, kase).text;
  assert.ok(out.startsWith('נועה כהן already real.'));
});

test('restore spans describe what changed (for the panel highlight)', () => {
  const { kase, sur } = setup();
  const s = sur('e1', 'first').he;
  const res = restore(`שלום ${s}`, kase);
  assert.equal(res.spans.length, 1);
  assert.equal(res.text.slice(res.spans[0].outStart, res.spans[0].outEnd), 'נועה');
});
