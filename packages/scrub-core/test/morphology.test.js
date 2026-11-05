import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createCase, scrub, restore, HE_PREFIXES } from '../src/index.js';

// Names chosen to start with prefix letters (ב, מ, ה, ל, ו, ש, כ) — the
// classic trap for prefix stripping.
const PEOPLE = [
  { gender: 'f', first: { he: 'נועה', en: 'Noa' } },
  { gender: 'f', first: { he: 'בתשבע', en: 'Batsheva' } },
  { gender: 'm', first: { he: 'משה', en: 'Moshe' } },
  { gender: 'f', first: { he: 'הדר', en: 'Hadar' } },
  { gender: 'f', first: { he: 'לאה', en: 'Leah' } },
  { gender: 'm', first: { he: 'ולדימיר', en: 'Vladimir' } },
  { gender: 'f', first: { he: 'שני', en: 'Shani' } },
  { gender: 'm', first: { he: 'כפיר', en: 'Kfir' } },
];

const mk = (p) => createCase({ seed: 'morph', entities: [{ kind: 'person', ...p }] });

for (const p of PEOPLE) {
  test(`every prefix combination × ${p.first.en}`, () => {
    const kase0 = mk(p);
    const probe = scrub(`${p.first.he} הגיע`, kase0);
    const sur = probe.case.mappings[0].sur.he;
    let kase = probe.case;
    for (const pre of HE_PREFIXES) {
      for (const hy of ['', '-', '־']) {
        const text = `אמר ${pre}${hy}${p.first.he} אתמול`;
        const r = scrub(text, kase);
        kase = r.case;
        assert.equal(r.text, `אמר ${pre}${hy}${sur} אתמול`, `scrub ${text}`);
        assert.equal(restore(r.text, kase).text, text, `restore ${text}`);
      }
    }
  });
}

test('a name inside a longer word is not touched', () => {
  const kase = createCase({ seed: 's', entities: [{ kind: 'person', gender: 'm', first: { he: 'דן', en: 'Dan' } }] });
  const text = 'עדן הלכה למדנים; Danny and Jordan stayed. דן נשאר.';
  const r = scrub(text, kase);
  assert.ok(r.text.startsWith('עדן הלכה למדנים; Danny and Jordan stayed.'), r.text);
  assert.ok(!/(?<![\p{L}])דן(?![\p{L}])/u.test(r.text));
});

test('niqqud and geresh variants still match', () => {
  const kase = createCase({ seed: 's', entities: [
    { kind: 'person', gender: 'f', first: { he: 'נועה', en: 'Noa' } },
    { kind: 'person', gender: 'm', first: { he: "ג'ורג'", en: 'George' } },
  ] });
  const r = scrub('נוֹעָה ראתה את ג׳ורג׳ ואת ג\'ורג\'.', kase);
  assert.ok(!/נ\p{M}*ו\p{M}*ע\p{M}*ה/u.test(r.text), r.text);
  assert.ok(!/ג['׳]ורג['׳]/.test(r.text), r.text);
});

test('English possessive, upper and lower case', () => {
  const kase = createCase({ seed: 's', entities: [{ kind: 'person', gender: 'f', first: { he: 'נועה', en: 'Noa' } }] });
  const text = "Noa's mother. NOA REFUSED. noa again. Noa’s book.";
  const r = scrub(text, kase);
  const sur = r.case.mappings[0].sur.en;
  assert.equal(r.text, `${sur}'s mother. ${sur.toUpperCase()} REFUSED. ${sur.toLowerCase()} again. ${sur}’s book.`);
  assert.equal(restore(r.text, r.case).text, text);
});

test('multi-word town with prefix', () => {
  const kase = createCase({ seed: 's', entities: [{ kind: 'town', he: 'ראשון לציון', en: 'Rishon LeZion' }] });
  const text = 'עברו מראשון לציון לפני שנה; גרו בראשון  לציון קודם. They left Rishon LeZion.';
  const r = scrub(text, kase);
  assert.ok(!r.text.includes('לציון') && !r.text.includes('LeZion'), r.text);
});
