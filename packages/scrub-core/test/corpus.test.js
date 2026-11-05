// The Phase 1 gate: zero leaks of declared and pattern-detectable identifiers
// across the whole synthetic corpus, and exact round-trip restore.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createCase, scrub, restore, buildGuard, findLeaks, parseDates } from '../src/index.js';
import { ALL_FAMILIES, buildCorpus, entitiesFor, groundTruth } from './corpus.js';

// Independent of the engine's matcher on purpose (simpler, stricter).
const PRE = '(?:ו?(?:ש|כש|מש|לכש)?[הבכלמ]?)';
function nameRegex(name) {
  const he = /[א-ת]/.test(name);
  const esc = name
    .replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    .replace(/["״]/g, '["״]').replace(/['׳]/g, "['׳]").replace(/\s+/g, '\\s+');
  return he
    ? new RegExp(`(?<![\\p{L}\\p{M}])${PRE}[-־]?${esc}(?![\\p{L}\\p{M}])`, 'u')
    : new RegExp(`(?<![\\p{L}])${esc}(?![\\p{L}])`, 'iu');
}
const blankDates = (t) => {
  let out = t;
  for (const d of parseDates(t).sort((a, b) => b.start - a.start)) out = out.slice(0, d.start) + ' '.repeat(d.end - d.start) + out.slice(d.end);
  return out;
};
const digitRuns = (t) => [...t.matchAll(/\+?\d[\d\s\-]*\d/g)].map((m) => m[0].replace(/\D/g, '').replace(/^972/, '0'));

function leaksIn(scrubbed, truth) {
  const leaks = [];
  const noDates = blankDates(scrubbed);
  for (const n of truth.names) if (nameRegex(n).test(noDates)) leaks.push('name:' + n);
  const runs = digitRuns(scrubbed);
  for (const d of truth.digits) if (runs.some((r) => r.includes(d))) leaks.push('digits:' + d);
  for (const e of truth.emails) if (scrubbed.toLowerCase().includes(e.toLowerCase())) leaks.push('email:' + e);
  for (const d of truth.dates) if (scrubbed.includes(d)) leaks.push('date:' + d);
  for (const s of truth.streets) if (scrubbed.includes(s)) leaks.push('street:' + s);
  return leaks;
}

const notes = buildCorpus();

test('corpus is large enough', () => {
  assert.ok(notes.length >= 50, `only ${notes.length} notes`);
  assert.ok(notes.filter((n) => /[א-ת]/.test(n.text)).length >= 50);
});

for (const fam of ALL_FAMILIES) {
  test(`family ${fam.key}: zero leaks, exact round trip, guard clean`, () => {
    // One case per family; notes are sent one after another like a conversation.
    let kase = createCase({ seed: 'corpus-' + fam.key, entities: entitiesFor(fam), community: fam.community });
    const truth = groundTruth(fam);
    const salt = 'test-salt-0123456789';
    for (const note of notes.filter((n) => n.family === fam.key)) {
      const r = scrub(note.text, kase);
      kase = r.case;
      assert.deepEqual(leaksIn(r.text, truth), [], `${note.id} leaked\n  in:  ${note.text}\n  out: ${r.text}`);
      assert.deepEqual(r.residual, [], `${note.id} residual`);
      const back = restore(r.text, kase);
      assert.equal(back.text, note.text, `${note.id} round trip`);
      const guard = buildGuard([kase], salt);
      assert.deepEqual(findLeaks(r.text, guard), [], `${note.id} guard flagged scrubbed text: ${r.text}`);
      assert.ok(findLeaks(note.text, guard).length > 0, `${note.id} guard missed the raw text`);
    }
    // Every surrogate is unique within the case.
    const surs = kase.mappings.filter((m) => !m.lossy && m.part !== 'last' && m.part !== 'core').map((m) => m.sur.en.toLowerCase());
    assert.equal(new Set(surs).size, surs.length, 'duplicate surrogates');
  });
}
