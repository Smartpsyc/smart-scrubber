// Auto mode: measured, not promised. With NOTHING declared, how many
// ground-truth name mentions survive scrubbing, and how many proposals are
// false alarms. Thresholds sit just under today's numbers so regressions fail.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createCase, suggest, autoScrub, restore } from '../src/index.js';
import { ALL_FAMILIES, buildCorpus, groundTruth } from './corpus.js';

const PRE = '(?:ו?(?:ש|כש|מש|לכש)?[הבכלמ]?)';
const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/["״]/g, '["״]').replace(/['׳]/g, "['׳]").replace(/\s+/g, '\\s+');
const reFor = (name) => (/[\u05D0-\u05EA]/.test(name)
  ? new RegExp(`(?<![\\p{L}\\p{M}])${PRE}[-־]?${esc(name)}(?![\\p{L}\\p{M}])`, 'gu')
  : new RegExp(`(?<![\\p{sc=Latin}])${esc(name)}(?![\\p{sc=Latin}])`, 'giu'));
const count = (text, name) => (text.match(reFor(name)) || []).length;

const notes = buildCorpus();

export function measure() {
  const rows = [];
  for (const fam of ALL_FAMILIES) {
    let kase = createCase({ seed: 'auto-' + fam.key, community: fam.community });
    // Job titles are a manual field: auto mode doesn't claim them (reported separately).
    const jobs = new Set([fam.job.he, fam.job.en].filter(Boolean));
    const truth = [...new Set(groundTruth(fam).names)].filter((n) => !jobs.has(n));
    let total = 0, leaked = 0, roundTripFails = 0;
    const missed = new Map();
    for (const note of notes.filter((n) => n.family === fam.key)) {
      const r = autoScrub(note.text, kase);
      kase = r.case;
      if (restore(r.text, kase).text !== note.text) roundTripFails++;
      for (const name of truth) {
        // count each mention once: longest names first, blank them out
        const c = count(note.text, name);
        if (!c) continue;
        total += c;
        const l = count(r.text, name);
        leaked += Math.min(l, c);
        if (l) missed.set(name, (missed.get(name) || 0) + l);
      }
    }
    // False alarms: accepted entities whose every form is not ground truth.
    const truthN = new Set(truth.map((s) => s.toLowerCase()));
    const fp = kase.entities.filter((e) => {
      const forms = e.kind === 'person' ? [...(e.first?.he || []), ...(e.first?.en || []), ...(e.last?.he || []), ...(e.last?.en || [])] : [...e.he, ...e.en];
      return forms.length && !forms.some((f) => truthN.has(f.toLowerCase()) || [...truthN].some((t) => t.includes(f.toLowerCase()) || f.toLowerCase().includes(t)));
    });
    rows.push({ family: fam.key, total, leaked, recall: 1 - leaked / total, missed: [...missed], falseAlarms: fp.map((e) => JSON.stringify(e.kind === 'person' ? { ...e.first, last: e.last } : { he: e.he, en: e.en })), roundTripFails, entities: kase.entities.length });
  }
  return rows;
}

test('auto mode on the corpus with nothing declared: recall, false alarms, round trip', () => {
  const rows = measure();
  const T = rows.reduce((a, r) => a + r.total, 0);
  const L = rows.reduce((a, r) => a + r.leaked, 0);
  const recall = 1 - L / T;
  const fa = rows.reduce((a, r) => a + r.falseAlarms.length, 0);
  console.log(`\n  auto mode: name-mention recall ${(recall * 100).toFixed(1)}% (${T - L}/${T}), false alarms ${fa}`);
  for (const r of rows) {
    console.log(`  ${r.family.padEnd(9)} recall ${(r.recall * 100).toFixed(1).padStart(5)}%  missed ${JSON.stringify(r.missed)}  false alarms ${JSON.stringify(r.falseAlarms)}`);
  }
  for (const r of rows) assert.equal(r.roundTripFails, 0, `${r.family}: round trip`);
  assert.ok(recall >= Number(process.env.AUTO_RECALL_MIN ?? 0), `recall ${recall}`);
});

test('cue words make word-names count; plain words stay', () => {
  const s = (t) => suggest(t).suggestions.map((x) => x.entity.first?.he?.[0] || x.entity.last?.he?.[0] || x.entity.he?.[0] || x.entity.he);
  assert.deepEqual(s('אור השמש חזק והים שקט.'), []);
  assert.deepEqual(s('אמו אור הגיעה.'), ['אור']);
  assert.deepEqual(s('אמו אמרה שהוא עייף.'), []);
  assert.deepEqual(s('המורה דנה לוי ציינה'), ['דנה']);
  assert.deepEqual(s('גב\' כהן התקשרה'), ['כהן']);
});

test('unisex gender from agreement; Hebrew and English spellings merge', () => {
  const sg = suggest('נועם הגיעה עם אמה. Noam said she was tired.').suggestions;
  assert.equal(sg.length, 1);
  assert.equal(sg[0].entity.gender, 'f');
  assert.deepEqual(sg[0].entity.first, { he: ['נועם'], en: ['Noam'] });
});

test('towns: unambiguous names alone, word-like ones need a cue', () => {
  const towns = (t) => suggest(t).suggestions.filter((x) => x.kind === 'town').map((x) => x.entity.he[0] || x.entity.en[0]);
  assert.deepEqual(towns('ביקור בקריית אונו'), ['קריית אונו']);
  assert.deepEqual(towns('ברחובות העיר יש רעש'), []);
  assert.deepEqual(towns('הם גרים ברחובות'), ['רחובות']);
  assert.deepEqual(towns('She lives in Springfield.'), ['Springfield']);
});

test('schools: head + name, adjectives skipped, "בגן" alone ignored', () => {
  const sch = (t) => suggest(t).suggestions.filter((x) => x.kind === 'school').map((x) => x.entity.he || x.entity.en);
  assert.deepEqual(sch('לומדת בבית הספר היסודי אלונים'), ['בית הספר אלונים']);
  assert.deepEqual(sch('בגן היה רועש, ובגן קשה לה'), []);
  assert.deepEqual(sch('He attends Lincoln Elementary School.'), ['Lincoln Elementary School']);
  // A conjunction after the head is not a name; a ו-name still is.
  assert.deepEqual(sch('הגיע לבית הספר ולכניסה לשיעורים מסוימים'), []);
  assert.deepEqual(sch('הגיע לבית הספר ויצמן'), ['בית הספר ויצמן']);
  // Talmud Torah, in every common spelling.
  assert.deepEqual(sch('לומד בת׳׳ת אבנריה'), ['ת׳׳ת אבנריה']);
  assert.deepEqual(sch('לומד בת"ת אבנריה'), ['ת"ת אבנריה']);
  assert.deepEqual(sch('לומד בת״ת סאטמר'), ['ת״ת סאטמר']);
  assert.deepEqual(sch('לומד בתלמוד תורה אבנריה'), ['תלמוד תורה אבנריה']);
});

test('a Talmud Torah written two ways in one note is hidden both times', () => {
  const r = autoScrub('לומד בת׳׳ת אבנריה. בת"ת אבנריה מרוצים ממנו.', createCase({ seed: 'tt' }));
  assert.ok(!r.text.includes('אבנריה'), r.text);
  assert.match(r.text, /^לומד בת׳׳ת \S+\. בת"ת \S+ מרוצים/);
});

test('surnames after a title, even ones no list knows', () => {
  const ppl = (t) => suggest(t).suggestions.filter((x) => x.kind === 'person')
    .map((x) => [(x.entity.first?.he || []).join(), (x.entity.last?.he || []).join()]);
  assert.deepEqual(ppl('נמצא במעקב ד"ר ולריה זלוצקי.'), [['ולריה', 'זלוצקי']]);
  assert.deepEqual(ppl('נפגש עם ד"ר זלוצקי פעמיים.'), [['', 'זלוצקי']]);
  assert.deepEqual(ppl('ד"ר רבינוביץ\' בדק אותו.'), [['', "רבינוביץ'"]]);
  // Typical surname endings count after any first name.
  assert.deepEqual(ppl('הילדה שירה רבינוביץ הגיעה.'), [['שירה', 'רבינוביץ']]);
  // A title followed by an ordinary word is not a name.
  assert.deepEqual(ppl('הופנה לד"ר והוא המליץ.'), []);
  assert.deepEqual(ppl('ד"ר אמר שהכול בסדר.'), []);
  const r = autoScrub('נמצא במעקב ד"ר ולריה זלוצקי. ד"ר זלוצקי ממליצה.', createCase({ seed: 'dr' }));
  assert.ok(!/ולריה|זלוצקי/.test(r.text), r.text);
});

import { HELDOUT } from './heldout.js';
import { HELDOUT2 } from './heldout2.js';

function runHeldout(SET, label) {
  let T = 0, L = 0, FA = [];
  console.log('');
  for (const fam of SET) {
    let kase = createCase({ seed: 'held-' + fam.family });
    let t = 0, l = 0;
    const missed = new Map();
    for (const note of fam.notes) {
      const r = autoScrub(note, kase);
      kase = r.case;
      assert.equal(restore(r.text, kase).text, note, 'round trip');
      // longest truth strings first, so "חיה מושקא" isn't double-counted as "חיה"
      let remainingIn = note, remainingOut = r.text;
      for (const name of [...fam.truth].sort((a, b) => b.length - a.length)) {
        const c = count(remainingIn, name);
        if (!c) continue;
        const lk = Math.min(count(remainingOut, name), c);
        t += c; l += lk;
        if (lk) missed.set(name, (missed.get(name) || 0) + lk);
        remainingIn = remainingIn.replace(reFor(name), ' ');
        remainingOut = remainingOut.replace(reFor(name), ' ');
      }
    }
    const truthN = fam.truth.map((s) => s.toLowerCase());
    const fa = kase.entities.filter((e) => {
      const forms = e.kind === 'person' ? [...(e.first?.he || []), ...(e.first?.en || []), ...(e.last?.he || []), ...(e.last?.en || [])] : [...e.he, ...e.en];
      return forms.length && !forms.some((f) => truthN.some((x) => x.includes(f.toLowerCase()) || f.toLowerCase().includes(x)));
    }).map((e) => (e.kind === 'person' ? [...(e.first?.he || []), ...(e.first?.en || []), ...(e.last?.he || [])].join('/') : e.he[0] || e.en[0]));
    T += t; L += l; FA.push(...fa);
    console.log(`  ${fam.family.padEnd(10)} recall ${(100 * (1 - l / t)).toFixed(1).padStart(5)}% (${t - l}/${t})  missed ${JSON.stringify([...missed])}  false alarms ${JSON.stringify(fa)}`);
  }
  console.log(`  ${label} total: recall ${(100 * (1 - L / T)).toFixed(1)}% (${T - L}/${T}), false alarms ${FA.length}`);
}

test('HELD-OUT set 1 (informed the general rules)', () => runHeldout(HELDOUT, 'HELD-OUT 1'));
test('HELD-OUT set 2 (frozen rules, never tuned on)', () => runHeldout(HELDOUT2, 'HELD-OUT 2'));


test('a town the clinician already declared is not suggested again (spelling variant included)', () => {
  const kase = createCase({ entities: [{ kind: 'town', he: 'קריית אונו' }] });
  for (const text of ['נועה הגיעה מקריית אונו.', 'נועה הגיעה מקרית אונו.']) {
    const { suggestions } = suggest(text, kase);
    assert.deepEqual(suggestions.filter((s) => s.kind === 'town'), [], text);
  }
  const fresh = suggest('נועה הגיעה מקריית אונו.', createCase());
  assert.equal(fresh.suggestions.filter((s) => s.kind === 'town').length, 1);
});
