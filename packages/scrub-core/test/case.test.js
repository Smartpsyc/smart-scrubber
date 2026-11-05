import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createCase, addEntities, scrub, restore, legend } from '../src/index.js';
import { POOLS } from '../src/pools.js';

const client = { kind: 'person', role: 'client', gender: 'f', first: { he: 'נועה', en: 'Noa' }, last: { he: 'כהן', en: 'Cohen' } };

test('deterministic per seed, varies across seeds', () => {
  const a = scrub('נועה', createCase({ seed: 'A', entities: [client] })).text;
  const a2 = scrub('נועה', createCase({ seed: 'A', entities: [client] })).text;
  assert.equal(a, a2);
  const outs = new Set();
  for (let i = 0; i < 30; i++) outs.add(scrub('נועה', createCase({ seed: 'S' + i, entities: [client] })).text);
  assert.ok(outs.size > 5);
});

test('surrogate keeps gender and comes from the matching pool', () => {
  for (let i = 0; i < 40; i++) {
    const k = scrub('x', createCase({ seed: 'g' + i, entities: [
      client,
      { kind: 'person', gender: 'm', first: { he: 'יוסי' } },
      { kind: 'person', gender: 'm', first: { en: 'John' } },
    ] })).case;
    const [f, m, en] = ['e1', 'e2', 'e3'].map((id) => k.mappings.find((x) => x.entityId === id && x.part === 'first').sur);
    assert.ok(POOLS.he.first.f.some((p) => p.he === f.he));
    assert.ok(POOLS.he.first.m.some((p) => p.he === m.he));
    assert.ok(POOLS.en.first.m.some((p) => p.en === en.en), 'English-only names get English-native surrogates');
  }
});

test('a surrogate never already appears in the text', () => {
  const allF = POOLS.he.first.f.map((p) => p.he).join(' ');
  for (let i = 0; i < 20; i++) {
    const r = scrub(`נועה ו${allF.split(' ').slice(0, -1).join(' ')}`, createCase({ seed: 'c' + i, entities: [client] }));
    const sur = r.case.mappings[0].sur.he;
    assert.equal(sur, POOLS.he.first.f.at(-1).he, 'only the one name absent from the text is allowed');
  }
});

test('a real declared name is never used as a surrogate', () => {
  for (let i = 0; i < 40; i++) {
    const r = scrub('', createCase({ seed: 'r' + i, entities: [
      { kind: 'person', gender: 'f', first: { he: 'אסתר', en: 'Esther' } },
      { kind: 'person', gender: 'f', first: { he: 'רבקה', en: 'Rivka' } },
    ] }));
    for (const m of r.case.mappings) assert.ok(!['אסתר', 'רבקה'].includes(m.sur.he));
  }
});

test('family members share the surrogate surname', () => {
  const k = scrub('', createCase({ seed: 'fam', entities: [
    client, { kind: 'person', gender: 'f', first: { he: 'רחל' }, last: { he: 'כהן', en: 'Cohen' } },
  ] })).case;
  const lasts = k.mappings.filter((m) => m.part === 'last');
  assert.equal(lasts.length, 2);
  assert.deepEqual(lasts[0].sur, lasts[1].sur);
});

test('pool exhaustion falls back to numbered tokens, with a warning', () => {
  const many = Array.from({ length: 5 }, (_, i) => ({ kind: 'person', gender: 'x', first: { he: `פלוני${'א'.repeat(i + 1)}` } }));
  const r = scrub(many.map((p) => p.first.he).join(' '), createCase({ seed: 'x', entities: many }));
  assert.match(r.text, /\[אדם 1\]/);
  assert.ok(r.warnings.some((w) => w.type === 'pool-exhausted'));
  assert.equal(restore(r.text, r.case).text, many.map((p) => p.first.he).join(' '));
});

test('school: generic head kept, distinctive part replaced, core alone also caught', () => {
  const k = createCase({ seed: 's', entities: [{ kind: 'school', he: 'בית ספר אלונים', en: 'Alonim School' }] });
  const r = scrub('לומדת בבית ספר אלונים. באלונים יש שילוב. Alonim School is far; at Alonim she…', k);
  assert.ok(!/אלונים|Alonim/.test(r.text), r.text);
  assert.match(r.text, /^לומדת בבית ספר \S+\./);
  assert.match(r.text, /\S+ School is far/);
  assert.equal(restore(r.text, r.case).text, 'לומדת בבית ספר אלונים. באלונים יש שילוב. Alonim School is far; at Alonim she…');
});

test('job title: custom replacement, or a numbered token', () => {
  const k = createCase({ seed: 'j', entities: [
    { kind: 'job', he: 'קצין משטרה', replacement: { he: 'עובד ציבור', en: 'civil servant' } },
    { kind: 'job', he: 'נהג משאית' },
    { kind: 'other', he: 'להקת בת שבע', en: 'Batsheva Dance Company' },
  ] });
  const text = 'האב קצין משטרה והדוד נהג משאית; האם רקדנית בלהקת בת שבע. He is a קצין משטרה, she danced with Batsheva Dance Company.';
  const r = scrub(text, k);
  assert.equal(r.text, 'האב עובד ציבור והדוד [תפקיד 1]; האם רקדנית ב[פרט 1]. He is a civil servant, she danced with [DETAIL 1].');
  assert.equal(restore(r.text, r.case).text, text);
});

test('scrub does not mutate the case it is given', () => {
  const k = createCase({ seed: 'm', entities: [client] });
  const snap = JSON.stringify(k);
  scrub('נועה 054-1234567 12/03/2024', k);
  assert.equal(JSON.stringify(k), snap);
});

test('entities added mid-conversation keep earlier mappings stable', () => {
  let k = createCase({ seed: 'mid', entities: [client] });
  const r1 = scrub('נועה', k);
  k = addEntities(r1.case, [{ kind: 'town', he: 'עפולה' }]);
  const r2 = scrub('נועה בעפולה', k);
  assert.ok(r2.text.startsWith(r1.text + ' ב'));
  assert.ok(!r2.text.includes('עפולה'));
});

test('a later message containing an old surrogate is flagged', () => {
  const r1 = scrub('נועה', createCase({ seed: 'late', entities: [client] }));
  const sur = r1.case.mappings[0].sur.he;
  const r2 = scrub(`גם ${sur} הגיעה`, r1.case);
  assert.ok(r2.warnings.some((w) => w.type === 'surrogate-in-text'));
});

test('validation: scripts and kinds', () => {
  assert.throws(() => createCase({ entities: [{ kind: 'person', first: { he: 'Noa' } }] }), /Hebrew/);
  assert.throws(() => createCase({ entities: [{ kind: 'planet', he: 'מאדים' }] }), /kind/);
  assert.throws(() => createCase({ entities: [{ kind: 'person', first: {} }] }), /first name or a surname/);
});

test('legend lists real ↔ surrogate for the panel', () => {
  const k = scrub('', createCase({ seed: 'l', entities: [client] })).case;
  const L = legend(k);
  assert.equal(L[0].real, 'נועה');
  assert.ok(L[0].surrogate.he && L[0].surrogate.en);
});

test('Arab community: surrogates come from the Arab pool; per-entity override works', () => {
  for (let i = 0; i < 20; i++) {
    const k = scrub('', createCase({ seed: 'ar' + i, community: 'arab', entities: [
      { kind: 'person', gender: 'm', first: { he: 'אחמד', en: 'Ahmad' }, last: { he: 'חורי' } },
      { kind: 'town', he: 'נצרת' },
      { kind: 'person', gender: 'f', community: 'general', first: { he: 'דנה' } },
    ] })).case;
    const sur = (id, part) => k.mappings.find((m) => m.entityId === id && m.part === part).sur.he;
    assert.ok(POOLS.ar.first.m.some((p) => p.he === sur('e1', 'first')));
    assert.ok(POOLS.ar.last.some((p) => p.he === sur('e1', 'last')));
    assert.ok(POOLS.ar.town.some((p) => p.he === sur('e2', 'name')));
    assert.ok(POOLS.he.first.f.some((p) => p.he === sur('e3', 'first')));
  }
});

test('pools: every surface form unique across all pools, none is a month name', async () => {
  const { HE_MONTHS, EN_MONTHS } = await import('../src/dates.js');
  const months = new Set([...HE_MONTHS.flat(), ...EN_MONTHS.flat()].map((s) => s.toLowerCase()));
  const seen = new Map();
  const walk = (o, path) => {
    if (Array.isArray(o)) {
      for (const e of o) for (const f of [e.he, e.en, ...e.dims.flatMap((d) => [d.he, d.en])]) {
        const k = f.toLowerCase();
        assert.ok(!months.has(k), `${f} is a month name`);
        assert.ok(!seen.has(k) || seen.get(k) === path, `${f} appears in ${seen.get(k)} and ${path}`);
        assert.ok(!seen.has(k), `${f} duplicated in ${path}`);
        seen.set(k, path);
      }
    } else for (const [k, v] of Object.entries(o)) walk(v, `${path}.${k}`);
  };
  walk(POOLS, 'POOLS');
});
