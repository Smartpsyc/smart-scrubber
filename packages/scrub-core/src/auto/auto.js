// Auto mode: propose entities (people, surnames, towns, schools) found in
// text nothing was declared for. Proposals are shown as chips the clinician
// can untick; accepted ones join the case, so later messages and the leak
// guard cover them. Auto mode WILL miss some names: the UI says so.

import {
  FIRST_NAMES, SURNAMES, WORD_NAMES_HE, WORD_NAMES_EN, STOP_HE, PERSON_CUES_HE, PERSON_CUES_EN,
  SURNAME_CUES_HE, TOWN_CUES_HE, TOWN_CUES_EN, FEM_MARKERS, MASC_MARKERS, SCHOOL_HEAD_RE_HE,
  SCHOOL_ADJ_HE, SCHOOL_TAIL_RE_EN, TOWN_DISTINCTIVE_HE, SURNAME_SUFFIX_RE_HE, PERSON_TITLES_HE,
} from './lexicon.js';
import { REGISTRY_NAMES } from './registry.js';
import { LOCALITIES } from './localities.js';
import { HE_PREFIXES, normalizeForm } from '../text.js';
import { parseDates, HE_MONTHS, EN_MONTHS } from '../dates.js';
import { addEntities, addNickname, addSpelling } from '../case.js';
import { sameName } from './translit.js';
import { detectPatterns } from '../detectors.js';
import { scrub } from '../scrub.js';

// ---------- indexes (built once) ----------

let IDX = null;
function idx() {
  if (IDX) return IDX;
  const firstHe = new Map();
  const firstEn = new Map();
  for (const e of FIRST_NAMES) {
    for (const [map, key] of [[firstHe, e.he], [firstEn, e.en.toLowerCase()]]) {
      if (!key) continue;
      const prev = map.get(key);
      // Same spelling listed under two genders → unisex.
      if (prev && prev.g !== e.g) map.set(key, { ...prev, g: 'x' });
      else if (!prev) map.set(key, e);
    }
  }
  const surHe = new Map();
  const surEn = new Map();
  for (const e of SURNAMES) {
    if (e.he) surHe.set(normalizeForm(e.he), e);
    if (e.en) surEn.set(e.en.toLowerCase(), e);
  }
  const loc = new Map(); // normalized words joined by ' ' → { he, en, words }
  const months = new Set([...HE_MONTHS.flat(), ...EN_MONTHS.flat()].map((m) => m.toLowerCase()));
  for (const l of LOCALITIES) {
    const rec = { he: l.he[0], en: l.en[0] || '', all: l };
    for (const f of [...l.he, ...l.en]) {
      const w = words(f);
      if (w.length) loc.set(w.join(' '), rec);
    }
  }
  IDX = { firstHe, firstEn, surHe, surEn, loc, months, maxLocWords: 5 };
  return IDX;
}

// ---------- tokenization ----------

const TOKEN_RE = /[\p{sc=Hebrew}\p{M}]+(?:['׳"״][\p{sc=Hebrew}\p{M}]+)*['׳]?|[\p{sc=Latin}\p{M}]+(?:['’][\p{sc=Latin}]+)*|\d+/gu;

function words(s) {
  return [...s.normalize('NFC').matchAll(TOKEN_RE)].map((m) => normalizeForm(m[0]));
}

function tokenize(text) {
  const toks = [];
  for (const m of text.matchAll(TOKEN_RE)) {
    const raw = m[0];
    toks.push({
      raw, n: normalizeForm(raw), start: m.index, end: m.index + raw.length,
      he: /[א-ת]/.test(raw), la: /[A-Za-z]/.test(raw), num: /^\d+$/.test(raw),
    });
  }
  for (let i = 0; i < toks.length; i++) {
    const gap = text.slice(i ? toks[i - 1].end : 0, toks[i].start);
    toks[i].gap = gap;
    toks[i].adjacent = i > 0 && /^[  ]+$/.test(gap);
    toks[i].sentenceStart = i === 0 || /[.!?\n:]\s*["'“]?\s*$/.test(gap) || /^\s*["'“(\-–]\s*$/.test(gap) && (i < 2 || /[.!?\n]/.test(text.slice(toks[i - 2]?.end ?? 0, toks[i - 1].start)));
  }
  return toks;
}

function prefixVariants(t) {
  const out = [{ base: t.n, pre: '' }];
  if (t.he) {
    for (const p of HE_PREFIXES) {
      if (t.n.startsWith(p) && t.n.length - p.length >= 2) out.push({ base: t.n.slice(p.length).replace(/^[-־]/, ''), pre: p });
    }
  }
  return out;
}

const stripPoss = (s) => s.replace(/['’]s$/i, '');
const isCap = (raw) => /^[A-Z]/.test(raw);
const isAllCaps = (raw) => raw.length > 1 && raw === raw.toUpperCase() && /[A-Z]/.test(raw);

// ---------- detection ----------

export function suggest(text, kase = null) {
  const I = idx();
  const toks = tokenize(text);
  const dateSpans = [...parseDates(text), ...detectPatterns(text)].map((d) => [d.start, d.end]);
  // Tokens overlapping a date or a detected pattern ("ברחוב הרצל 40": the ב sits outside the span).
  const inDate = (t) => dateSpans.some(([a, b]) => t.start < b && a < t.end);
  const declared = new Set();
  const declaredFirst = new Map(); // normalized first-name form → entity id
  if (kase) {
    for (const e of kase.entities) if (e.kind === 'person') for (const f of [...e.first.he, ...e.first.en]) declaredFirst.set(normalizeForm(f), e.id);
    for (const m of kase.mappings) for (const f of [...m.real.he, ...m.real.en]) declared.add(normalizeForm(f));
    for (const e of kase.entities) {
      const add = (f) => f && [...f.he, ...f.en].forEach((s) => declared.add(normalizeForm(s)));
      if (e.kind === 'person') { add(e.first); add(e.last); e.nicknames.forEach(add); } else add(e);
    }
  }

  const people = new Map(); // key → { g, first:{he:Set,en:Set}, last:{he:Set,en:Set}, occ:[], reasons:Set, conf }
  const places = new Map();
  const schools = new Map();
  const used = new Set(); // token indexes already claimed

  const personKey = (entry, raw) => (entry ? `L:${entry.he}|${entry.en}` : `R:${normalizeForm(raw)}`);
  // "מר כהן", "משפחת אזולאי", "Mrs. Cohen": a person known only by surname.
  const addSurnameOnly = ({ i, script, g, reason, conf }) => {
    const t = toks[i];
    const e = t.he ? I.surHe.get(t.n) : I.surEn.get(stripPoss(t.n));
    const key = 'S:' + (e ? `${e.he}|${e.en}` : normalizeForm(stripPoss(t.raw)));
    let p = people.get(key);
    if (!p) {
      p = { g: g || null, first: { he: new Set(), en: new Set() }, last: { he: new Set(), en: new Set() }, occ: [], reasons: new Set(), conf, surnameOnly: true };
      people.set(key, p);
    }
    p.occ.push(i);
    p.reasons.add(reason);
    if (conf === 'high') p.conf = 'high';
    addSurnameTo(p, i);
  };
  const addPerson = ({ entry, form, script, g, i, reason, conf, lastTok }) => {
    const key = personKey(entry, form);
    let p = people.get(key);
    if (!p) {
      p = { g: g || (entry && entry.g) || null, first: { he: new Set(), en: new Set() }, last: { he: new Set(), en: new Set() }, occ: [], reasons: new Set(), conf };
      people.set(key, p);
    }
    if (!p.g && g) p.g = g;
    if (entry) { if (entry.he) p.first.he.add(entry.he); if (entry.en) p.first.en.add(entry.en); }
    p.first[script].add(form);
    p.occ.push(i);
    p.reasons.add(reason);
    if (conf === 'high') p.conf = 'high';
    used.add(i);
    if (lastTok != null) addSurnameTo(p, lastTok);
    addNickAfter(p, lastTok != null ? lastTok : i);
    return p;
  };
  // 'קוראים ליונתן "יוני"', 'Yonatan ("Yoni")', 'נועה (נועי)'
  // One word, properly closed: ("Yoni"), (נועי), "נועי". Not '"תסומן/יסומן"'.
  const NICK_RE = /^\s*(?:\(\s*["“״']?([\p{L}\p{M}'׳]{2,})["”״']?\s*\)|["“״]([\p{L}\p{M}'׳]{2,})["”״](?![\p{L}\/]))/u;
  const addNickAfter = (p, j) => {
    const t = toks[j];
    if (!t) return;
    const m = NICK_RE.exec(text.slice(t.end, t.end + 40));
    if (!m) return;
    const nick = (m[1] || m[2]).replace(/['׳]$/, '');
    const nn = normalizeForm(nick);
    // Hebrew: a quoted word is often speech. Accept a registered name, or one
    // introduced by "קוראים ל…" / "מכונה" / "כינוי".
    if (/[\u05D0-\u05EA]/.test(nick)) {
      const lead = text.slice(Math.max(0, t.start - 25), t.start);
      if (!REGISTRY_NAMES.has(nn) && !I.firstHe.has(nn) && !/(קוראים|מכונה|מכנים|כינוי|הכינוי)\s*\S*\s*$/.test(lead)) return;
    } else if (!/^[A-Z]/.test(nick)) return;
    if (STOP_HE.has(nn) || COMMON_CAPS.has(nn) || /^\d/.test(nick)) return;
    if ([...p.first.he, ...p.first.en, ...p.last.he, ...p.last.en].some((f) => normalizeForm(f) === nn)) return;
    p.nicks = p.nicks || new Map();
    p.nicks.set(nn, nick);
    const k = toks.findIndex((x) => x.start >= t.end && normalizeForm(x.raw) === nn);
    if (k >= 0) used.add(k);
  };
  const addSurnameTo = (p, j) => {
    const t = toks[j];
    const e = t.he ? I.surHe.get(t.n) : I.surEn.get(stripPoss(t.n));
    if (e) { if (e.he) p.last.he.add(e.he); if (e.en) p.last.en.add(e.en); }
    else if (t.he) p.last.he.add(t.raw);
    else p.last.en.add(stripPoss(t.raw));
    used.add(j);
  };
  const surnameAt = (j, strict = true) => {
    const t = toks[j];
    if (!t || !t.adjacent || inDate(t)) return false;
    if (t.he) return !STOP_HE.has(t.n) && (I.surHe.has(t.n) || (SURNAME_SUFFIX_RE_HE.test(t.n) && plainWord(t)));
    if (t.la) {
      const n = stripPoss(t.n);
      if (I.surEn.has(n)) return isCap(t.raw);
      return !strict && isCap(t.raw) && !I.months.has(n) && !COMMON_CAPS.has(n) && !I.firstEn.has(n);
    }
    return false;
  };

  // A word that could be a name: not a function word, verb, cue or month,
  // under any prefix reading ("והוא", "שאמרה").
  const plainWord = (t) => t && t.he && !t.num && !inDate(t) && t.n.length >= 2
    && prefixVariants(t).every((v) => !STOP_HE.has(v.base) && !COMMON_HE.has(v.base) && !(v.base in PERSON_CUES_HE)
      && !FEM_MARKERS.has(v.base) && !MASC_MARKERS.has(v.base) && !I.months.has(v.base));
  // After a title the next word is a surname even when no list knows it:
  // "ד"ר ולריה זלוצקי", "ד"ר זלוצקי".
  const titleSurnameAt = (j) => { const t = toks[j]; return !!(t && t.adjacent && plainWord(t) && !I.firstHe.has(t.n)); };

  // Cue words may carry ו/ש/ל ("ולאמו", "שאמו"); ב/מ/כ/ה only on longer
  // words ("באביו") — "מבנה" is "structure", not מ+בנה. An adjective may sit
  // between cue and name ("אחותה הגדולה שרי", "הגננת הקודמת, סבטה").
  const cueWord = (tok) => (tok && tok.he ? prefixVariants(tok)
    .filter((v) => /^(|ו|ש|וש|כש|וכש|ל|ול|של)$/.test(v.pre) || (/^(ב|מ|כ|ה|וב|ומ)$/.test(v.pre) && v.base.length >= 4))
    .map((v) => v.base).find((b) => b in PERSON_CUES_HE) : null);
  const cueBefore = (i) => {
    const t = toks[i];
    if (!/^[ \u00A0]*[,:]?[ \u00A0]+$/.test(t.gap)) return null;
    let j = i - 1;
    if (toks[j] && CUE_ADJ_HE.has(toks[j].n) && /^[ \u00A0]+$/.test(toks[j].gap)) j--;
    return cueWord(toks[j]);
  };

  // 0. Name followed by an age: "ראמז חלבי, בן 15", "נועה (בת 9)", "Abebe Tekle (13)",
  //    "Ramez Halabi, 15,". In clinical notes this is almost always the client.
  const AGE_HE = /^\s*(?:,\s*|\(\s*)(בן|בת)\s+\d{1,2}\b/u;
  const AGE_EN = /^\s*(?:\(\s*\d{1,2}\s*\)|,\s*(?:aged?\s+)?\d{1,2}\s*[,)]|,\s*(?:a|an)\s+\d{1,2}-year-old)/u;
  for (let i = 0; i < toks.length; i++) {
    const t = toks[i];
    if (!t.sentenceStart || t.num) continue;
    for (let n = 3; n >= 1; n--) {
      const span = toks.slice(i, i + n);
      if (span.length < n || span.some((x, k) => (k > 0 && !x.adjacent) || x.he !== t.he || x.num || STOP_HE.has(x.n) || (x.n in PERSON_CUES_HE) || COMMON_HE.has(x.n) || (x.la && !isCap(x.raw)) || (x.la && COMMON_CAPS.has(stripPoss(x.n))))) continue;
      const after = text.slice(span[n - 1].end, span[n - 1].end + 30);
      const mh = t.he && AGE_HE.exec(after);
      const me = t.la && AGE_EN.exec(after);
      if (!mh && !me) continue;
      const g = mh ? (mh[1] === 'בן' ? 'm' : 'f') : null;
      const firstN = n === 3 ? 2 : 1;
      const firstToks = span.slice(0, firstN);
      const form = text.slice(firstToks[0].start, firstToks[firstN - 1].end);
      const entry = t.he ? I.firstHe.get(normalizeForm(form)) : I.firstEn.get(normalizeForm(form));
      if (declared.has(normalizeForm(form))) break;
      const p = addPerson({ entry, form, script: t.he ? 'he' : 'en', g, i, reason: 'name+age', conf: 'high', lastTok: n > firstN ? i + n - 1 : null });
      for (let k = 1; k < firstN; k++) used.add(i + k);
      if (n > firstN) used.add(i + n - 1);
      void p;
      break;
    }
  }

  // 1. Form fields: "שם: נועה כהן", "Name: Noa Cohen"
  const FIELD_RE = /(?<![\p{L}])(שם(?:\s+(?:הילד|הילדה|התלמיד|התלמידה|המטופל|המטופלת|הפונה|פרטי|מלא|האם|האב))?|שם\s+משפחה|(?:Client|Patient|Student|Child|Full)?\s?[Nn]ame|CLIENT|PATIENT|NAME)\s*[:：]\s*/gu;
  for (const m of text.matchAll(FIELD_RE)) {
    const at = m.index + m[0].length;
    const i = toks.findIndex((t) => t.start >= at);
    if (i < 0 || toks[i].start !== at || toks[i].num) continue;
    const lastOnly = /משפחה/.test(m[1]);
    const t = toks[i];
    if (STOP_HE.has(t.n)) continue;
    const script = t.he ? 'he' : 'en';
    const entry = t.he ? I.firstHe.get(t.n) : I.firstEn.get(stripPoss(t.n));
    if (lastOnly) {
      addSurnameOnly({ i, script, reason: 'form-field', conf: 'high' });
      continue;
    }
    const next = toks[i + 1];
    const hasLast = next && next.adjacent && !next.num && !STOP_HE.has(next.n) && next.he === t.he && !inDate(next);
    addPerson({ entry, form: t.he ? t.raw : stripPoss(t.raw), script, i, reason: 'form-field', conf: 'high', lastTok: hasLast ? i + 1 : null });
  }

  for (let i = 0; i < toks.length; i++) {
    const t = toks[i];
    if (used.has(i) || t.num || inDate(t) || declared.has(t.n)) continue;
    const prev = toks[i - 1];

    if (t.he) {
      // 2. Cue right before: "אמו רחל", "המורה דנה לוי", "גב' כהן"
      const cueGap = prev && /^[  ]*[,:]?[  ]+$|^[  ]+$/.test(t.gap);
      const cue = cueBefore(i);
      if (cue && !STOP_HE.has(t.n) && !I.months.has(t.n)) {
        const g = PERSON_CUES_HE[cue];
        if (I.surHe.has(t.n) && !I.firstHe.has(t.n) && (cue.startsWith('גב') || cue === 'מר' || cue.startsWith('ד') || cue.startsWith('פרופ') || cue.startsWith('עו'))) {
          addSurnameOnly({ i, script: 'he', g, reason: 'cue:' + cue, conf: 'high' });
          continue;
        }
        const title = PERSON_TITLES_HE.test(cue);
        const entry = I.firstHe.get(t.n);
        // "עם האחות, רצון מתמשך…": after a comma the word starts a new phrase;
        // only a name on the curated list counts there, not a registry-only one.
        // An appositive name is set off: "האם, הדסה גרינוולד,", "אמה, אלמז, לא…".
        const nxC = toks[i + 1];
        const setOff = !nxC || /[,.;:!?)\n–]/.test(nxC.gap) || surnameAt(i + 1) || (nxC.adjacent && VERB_MARKERS.has(nxC.n))
          || (nxC.adjacent && plainWord(nxC) && toks[i + 2] && /,/.test(toks[i + 2].gap)); // "הדסה גרינוולד,"
        const commaGap = /,/.test(t.gap) && !setOff;
        if (entry || (REGISTRY_NAMES.has(t.n) && !commaGap)) {
          const withLast = surnameAt(i + 1) || (title && titleSurnameAt(i + 1));
          addPerson({ entry, form: t.raw, script: 'he', g, i, reason: 'cue:' + cue, conf: entry ? 'high' : 'medium', lastTok: withLast ? i + 1 : null });
          continue;
        }
        if (title && plainWord(t)) {
          addSurnameOnly({ i, script: 'he', g, reason: 'cue:' + cue, conf: SURNAME_SUFFIX_RE_HE.test(t.n) ? 'high' : 'medium' });
          continue;
        }
      }
      // 3. "משפחת כהן"
      if (prev && prefixVariants(prev).some((v) => SURNAME_CUES_HE.has(v.base)) && t.adjacent && !STOP_HE.has(t.n)) {
        addSurnameOnly({ i, script: 'he', reason: 'cue:משפחת', conf: I.surHe.has(t.n) ? 'high' : 'medium' });
        continue;
      }
      // 4. Curated first-name list, prefix-aware.
      for (const v of prefixVariants(t)) {
        const entry = I.firstHe.get(v.base);
        if (!entry || I.months.has(v.base)) continue;
        const pairedWithSurname = surnameAt(i + 1);
        const word = WORD_NAMES_HE.has(v.base);
        // "נועם הגיעה", "אבי סיפר": a word-name directly followed by a verb is a name.
        const nx = toks[i + 1];
        const verbAfter = nx && nx.adjacent && VERB_MARKERS.has(nx.n);
        // "איתן, אחיו של נועה": a relation word right after the name.
        const appos = nx && /^\s*[,–-]\s*$/.test(nx.gap) && (nx.n in PERSON_CUES_HE) && !nx.n.startsWith('ה');
        if (word && !pairedWithSurname && !verbAfter && !appos) continue;
        // A prefixed reading only when the whole token isn't itself a name/word.
        if (v.pre && I.firstHe.has(t.n)) continue;
        addPerson({ entry, form: v.base === t.n ? t.raw : t.raw.slice(t.raw.length - v.base.length), script: 'he', g: appos ? PERSON_CUES_HE[nx.n] : null, i, reason: word ? (pairedWithSurname ? 'list+surname' : appos ? 'list+relation' : 'list+verb') : 'list', conf: word && !pairedWithSurname ? 'medium' : 'high', lastTok: pairedWithSurname ? i + 1 : null });
        break;
      }
      continue;
    }

    if (t.la) {
      const n = stripPoss(t.n);
      if (!isCap(t.raw)) continue;
      const allCaps = isAllCaps(t.raw);
      // Test codes and acronyms: "ADI-R", "WISC-V", "ADOS". An all-caps word
      // is a name only with a cue or an all-caps surname right after it.
      const nxL = toks[i + 1];
      if (allCaps && !(prev && prev.la && prev.n in PERSON_CUES_EN) && !(nxL && nxL.adjacent && nxL.la && isAllCaps(nxL.raw) && !COMMON_CAPS.has(nxL.n))) continue;
      const cueWord = prev && prev.la ? prev.n : null;
      const cue = cueWord && cueWord in PERSON_CUES_EN && /^[.,]?\s+$/.test(t.gap) ? cueWord : null;
      const entry = I.firstEn.get(n);
      const word = WORD_NAMES_EN.has(n);
      let ok = false, reason = 'list', conf = 'high';
      if (entry && !word) ok = true;
      else if (entry && word && !t.sentenceStart && !allCaps) { ok = true; reason = 'list+capital'; }
      else if (cue && !I.months.has(n) && !COMMON_CAPS.has(n)) {
        if (I.surEn.has(n) && ['mr', 'mrs', 'ms', 'dr', 'miss', 'prof'].includes(cue)) {
          addSurnameOnly({ i, script: 'en', g: PERSON_CUES_EN[cue], reason: 'cue:' + cue, conf: 'high' });
          continue;
        }
        ok = true; reason = 'cue:' + cue; conf = entry ? 'high' : 'medium';
      }
      if (!ok) continue;
      const lastOk = surnameAt(i + 1, false) && (allCaps ? isAllCaps(toks[i + 1].raw) : !isAllCaps(toks[i + 1].raw) || true);
      addPerson({ entry, form: allCaps ? (entry ? entry.en : t.raw) : stripPoss(t.raw), script: 'en', g: cue ? PERSON_CUES_EN[cue] : null, i, reason, conf, lastTok: lastOk ? i + 1 : null });
    }
  }

  // 5. Towns (multi-word first; single words that are also names/words need a cue).
  for (let i = 0; i < toks.length; i++) {
    if (used.has(i) || toks[i].num || inDate(toks[i])) continue;
    const t = toks[i];
    let hit = null;
    for (let n = Math.min(I.maxLocWords, toks.length - i); n >= 1 && !hit; n--) {
      const span = toks.slice(i, i + n);
      if (span.some((x, k) => (k > 0 && !/^[  \-־–]+$/.test(x.gap)) || used.has(i + k) || x.he !== t.he)) continue;
      const rest = span.slice(1).map((x) => x.n);
      for (const v of prefixVariants(t)) {
        if (/ש$/.test(v.pre)) continue; // "שאלון מורה" is a questionnaire, not ש+אלון מורה
        const rec = I.loc.get([v.base, ...rest].join(' '));
        if (rec) { hit = { rec, n, pre: v.pre, base: v.base }; break; }
      }
    }
    if (!hit) continue;
    // A town cue up to 4 words back in the same clause: "גר עם אמו גלית בעומר".
    let cue = false;
    for (let k = i - 1, steps = 0; k >= 0 && steps < 4; k--, steps++) {
      if (/[.!?;\n]/.test(toks[k + 1].gap)) break;
      const pv = toks[k];
      if (t.he ? prefixVariants(pv).some((v) => TOWN_CUES_HE.has(v.base)) : TOWN_CUES_EN.has(pv.n)) { cue = true; break; }
      if (!t.he) break; // English: only the word right before
    }
    const single = hit.n === 1;
    const base = hit.base;
    // Single-word localities are words or names more often than not
    // (רחוב, מצליח, חוסן, שירה): only hand-checked distinctive ones count alone.
    const ambiguous = single && !TOWN_DISTINCTIVE_HE.has(normalizeForm(hit.rec.he).replace(/'/g, "'"))
      && !TOWN_DISTINCTIVE_HE.has(hit.rec.he);
    if (ambiguous && !cue) continue;
    // A town that is also a first name ("נועם", "עדי"): "לגור עם נועם" is a
    // person. Needs a place preposition on the word or a settlement word before it.
    if (ambiguous && t.he && (I.firstHe.has(base) || REGISTRY_NAMES.has(base))) {
      const pv = toks[i - 1];
      const placePre = /^ו?(ב|מ|ל|מה|לה)$/.test(hit.pre);
      const settlement = pv && /^[  ]+$/.test(t.gap) && prefixVariants(pv).some((v) => SETTLEMENT_HE.has(v.base));
      if (!placePre && !settlement) continue;
    }
    if (!t.he && !isCap(t.raw)) continue;
    const writtenForm = text.slice(t.start + (hit.pre ? hit.pre.length : 0), toks[i + hit.n - 1].end).replace(/^[-־]/, '');
    if (declared.has(normalizeForm(writtenForm)) || [...hit.rec.all.he, ...hit.rec.all.en].some((f) => declared.has(normalizeForm(f)))) {
      for (let k = 0; k < hit.n; k++) used.add(i + k); // already in the case
      i += hit.n - 1;
      continue;
    }
    const key = hit.rec.he;
    let p = places.get(key);
    if (!p) places.set(key, (p = { rec: hit.rec, occ: [], reasons: new Set(), conf: ambiguous ? 'medium' : 'high', forms: { he: new Set(), en: new Set() } }));
    const written = text.slice(t.start + (hit.pre ? hit.pre.length : 0), toks[i + hit.n - 1].end).replace(/^[-־]/, '');
    p.forms[t.he ? 'he' : 'en'].add(written);
    p.occ.push(i);
    p.reasons.add(cue ? 'locality+cue' : 'locality');
    for (let k = 0; k < hit.n; k++) used.add(i + k);
    i += hit.n - 1;
  }

  // Nicknames of people declared earlier in the case: 'Yonatan ("Yoni")'.
  const nickSuggestions = new Map();
  const pushNick = (entityId, nick) => {
    const nn = normalizeForm(nick);
    if (declared.has(nn) || STOP_HE.has(nn) || COMMON_CAPS.has(nn)) return;
    nickSuggestions.set(entityId + '|' + nn, { entityId, nick });
  };
  for (let i = 0; i < toks.length; i++) {
    const id = declaredFirst.get(toks[i].n) || declaredFirst.get(stripPoss(toks[i].n));
    if (!id) continue;
    const probe = { first: { he: new Set(), en: new Set() }, last: { he: new Set(), en: new Set() } };
    addNickAfter(probe, i);
    if (probe.nicks) for (const n of probe.nicks.values()) pushNick(id, n);
  }

  // 'ולנטינה מכונה בבית "קטיה"', 'קוראים לה "קטיה"' → nickname of the nearest preceding person.
  for (const m of text.matchAll(/(?<![\p{L}])(?:מכונה|מכונים|מכנים\s+אות[הו]|קוראים\s+ל[הו]|הכינוי\s+של[הו])(?:\s+[\u05D0-\u05EA]+){0,2}\s+["“״]([\u05D0-\u05EA'׳]{2,})["”״]/gu)) {
    const nick = m[1];
    const prevDeclared = toks.filter((t) => t.end <= m.index && declaredFirst.has(t.n)).pop();
    const before = [...people.values()].filter((p) => !p.surnameOnly && p.occ.some((i) => toks[i].end <= m.index)).pop();
    const beforeEnd = before ? Math.max(...before.occ.filter((i) => toks[i].end <= m.index).map((i) => toks[i].end)) : -1;
    if (prevDeclared && prevDeclared.end > beforeEnd) pushNick(declaredFirst.get(prevDeclared.n), nick);
    else if (before) { before.nicks = before.nicks || new Map(); before.nicks.set(normalizeForm(nick), nick); }
  }

  // English "goes by X" / "known as X" → nickname of the nearest preceding person.
  for (const m of text.matchAll(/\b(?:goes by|known as|nicknamed|called)\s+["“]?([A-Z][a-z]+)/g)) {
    const prevDeclared = toks.filter((t) => t.end <= m.index && declaredFirst.has(stripPoss(t.n))).pop();
    const before = [...people.values()].filter((p) => p.occ.some((i) => toks[i].end <= m.index)).pop();
    const beforeEnd = before ? Math.max(...before.occ.map((i) => toks[i].end)) : -1;
    if (prevDeclared && prevDeclared.end > beforeEnd) { pushNick(declaredFirst.get(stripPoss(prevDeclared.n)), m[1]); continue; }
    if (!before || !before.first.he.size && !before.first.en.size) continue;
    before.nicks = before.nicks || new Map();
    before.nicks.set(m[1].toLowerCase(), m[1]);
  }

  // 5b. English places not on the Israeli list: "lives in Springfield", "moved to Leeds".
  const EN_PLACE_RE = /\b(?:lives?|living|lived|moved|moving|relocated|resident|born|grew up|home|School|Academy|Kindergarten|College|Clinic|Hospital|Center|Centre)\s+(?:in|to|from|of|at)\s+((?:[A-Z][\p{L}'’-]+)(?:\s+[A-Z][\p{L}'’-]+){0,2})/gu;
  for (const m of text.matchAll(EN_PLACE_RE)) {
    const name = m[1];
    const n = normalizeForm(name);
    if (declared.has(n) || I.months.has(n) || COMMON_CAPS.has(n) || I.firstEn.has(n) || places.has('EN:' + n)) continue;
    if ([...places.values()].some((p) => [...p.forms.en].some((f) => normalizeForm(f) === n))) continue;
    places.set('EN:' + n, { rec: { he: '', en: name, all: { he: [], en: [name] } }, occ: [], reasons: new Set(['phrase']), conf: 'medium', forms: { he: new Set(), en: new Set([name]) } });
  }

  // 6. Schools: head word + distinctive name.
  for (const m of text.matchAll(SCHOOL_HEAD_RE_HE)) {
    const headEnd = m.index + m[0].length;
    let j = toks.findIndex((t) => t.start >= headEnd);
    if (j < 0) continue;
    while (toks[j] && SCHOOL_ADJ_HE.has(toks[j].n) && /^[  ]+$/.test(toks[j].gap)) j++;
    const c = toks[j];
    if (!c || !c.he || c.num || !/^[  "״'׳]+$/.test(c.gap) || STOP_HE.has(c.n) || COMMON_HE.has(c.n) || inDate(c)) continue;
    // "בית הספר ולכניסה…": a conjunction, not a school name (unless the word is itself a name: "ויצמן").
    if (/^ו/.test(c.n) && !(REGISTRY_NAMES.has(c.n) || I.surHe.has(c.n) || I.loc.has(c.n))) continue;
    const head = m[1].replace(/\s+/g, ' ');
    if (head === 'גן' && !(REGISTRY_NAMES.has(c.n) || I.loc.has(c.n) || /["״]/.test(c.gap))) {
      // "בגן" is usually just "in the kindergarten"; only accept a known name or a quoted one.
      continue;
    }
    if (prefixVariants(c).some((v) => /^[בלמ]$/.test(v.pre) && ([...I.loc.keys()].some((k) => k === v.base || k.startsWith(v.base + ' '))))) continue;
    let core = c.raw;
    const c2 = toks[j + 1];
    if (c2 && c2.adjacent && c2.he && !STOP_HE.has(c2.n) && !COMMON_HE.has(c2.n) && (I.surHe.has(c2.n) || I.firstHe.has(c2.n) || REGISTRY_NAMES.has(c2.n))) core += ' ' + c2.raw;
    if (declared.has(normalizeForm(core))) continue;
    const key = normalizeForm(core);
    if (!schools.has(key)) schools.set(key, { he: `${head} ${core}`, en: null, occ: [j], conf: head === 'גן' ? 'medium' : 'high' });
  }
  for (const m of text.matchAll(SCHOOL_TAIL_RE_EN)) {
    let names = m[1].trim().split(/\s+/);
    const startIdx = toks.findIndex((t) => t.start === m.index);
    if (names.length > 1 && startIdx >= 0 && toks[startIdx].sentenceStart) names = names.slice(1);
    names = names.slice(-2).filter((w) => !['The', 'At', 'Attends', 'Attending', 'From', 'To'].includes(w));
    if (!names.length) continue;
    const full = `${names.join(' ')} ${m[2]}`;
    const key = normalizeForm(names.join(' '));
    if (declared.has(key)) continue;
    if (!schools.has(key)) schools.set(key, { he: null, en: full, occ: [], conf: 'high' });
    else if (!schools.get(key).en) schools.get(key).en = full;
  }

  // 7. Gender for unisex / cue-only names, from agreement right after each mention.
  for (const p of people.values()) {
    if (p.g && p.g !== 'x') continue;
    let f = 0, mm = 0;
    for (const i of p.occ) {
      for (let k = i + 1; k <= i + 4 && k < toks.length; k++) {
        if (/[.!?\n]/.test(toks[k].gap)) break;
        if (FEM_MARKERS.has(toks[k].n)) f++;
        if (MASC_MARKERS.has(toks[k].n)) mm++;
      }
      const pv = toks[i - 1];
      if (pv && PERSON_CUES_HE[pv.n] === 'f') f++;
      if (pv && PERSON_CUES_HE[pv.n] === 'm') mm++;
    }
    p.g = f > mm ? 'f' : mm > f ? 'm' : 'x';
    p.needsGender = f === mm && !p.surnameOnly; // a family surname has no gender
  }

  // 8. English spellings of Hebrew names (found here or declared earlier):
  //    "Valentina Kozlov" for ולנטינה קוזלוב. Only where a name is plausible:
  //    mid-sentence capitals, or a sentence-initial pair that both match.
  const heTargets = [];
  for (const p of people.values()) {
    for (const f of p.first.he) heTargets.push({ he: f, apply: (en) => p.first.en.add(en) });
    for (const f of p.last.he) heTargets.push({ he: f, apply: (en) => p.last.en.add(en) });
  }
  const spellingSuggestions = new Map();
  if (kase) {
    for (const e of kase.entities) {
      if (e.kind !== 'person') continue;
      const parts = [['first', e.first], ['last', e.last], ...e.nicknames.map((n, k) => [`nick${k}`, n])];
      for (const [part, f] of parts) {
        if (!f || f.en.length) continue; // already has an English spelling
        for (const he of f.he) heTargets.push({ he, apply: (en) => spellingSuggestions.set(`${e.id}|${part}|${en}`, { entityId: e.id, part, en }) });
      }
    }
  }
  const matchTok = (t) => (t && t.la && isCap(t.raw) && !used.has(toks.indexOf(t)) && !declared.has(stripPoss(t.n))
    && !COMMON_CAPS.has(stripPoss(t.n)) && !I.months.has(stripPoss(t.n))
    ? heTargets.find((x) => sameName(x.he, stripPoss(t.raw))) : null);
  for (let i = 0; i < toks.length; i++) {
    const t = toks[i];
    const hit = matchTok(t);
    if (!hit) continue;
    if (t.sentenceStart) {
      const nx = toks[i + 1];
      if (!(nx && nx.adjacent && matchTok(nx))) continue;
    }
    const form = isAllCaps(t.raw) ? stripPoss(t.raw)[0] + stripPoss(t.raw).slice(1).toLowerCase() : stripPoss(t.raw);
    hit.apply(form);
    used.add(i);
  }

  // ---------- output ----------
  const suggestions = [];
  const coveredLast = new Set();
  for (const p of people.values()) if (!p.surnameOnly) for (const x of [...p.last.he, ...p.last.en]) coveredLast.add(normalizeForm(x));
  for (const p of people.values()) {
    if (p.surnameOnly && [...p.last.he, ...p.last.en].every((x) => coveredLast.has(normalizeForm(x)))) continue;
    const first = { he: [...p.first.he], en: [...p.first.en] };
    const last = { he: [...p.last.he], en: [...p.last.en] };
    const entity = { kind: 'person', gender: p.g || 'x' };
    if (first.he.length || first.en.length) entity.first = first;
    if (last.he.length || last.en.length) entity.last = last;
    if (p.nicks && entity.first) entity.nicknames = [...p.nicks.values()].map((n) => (/[\u05D0-\u05EA]/.test(n) ? { he: n } : { en: n }));
    suggestions.push({
      kind: 'person', entity, confidence: p.conf || 'medium', reasons: [...p.reasons],
      needsGender: !!p.needsGender, mentions: p.occ.map((i) => ({ start: toks[i].start, end: toks[i].end })),
    });
  }
  for (const p of places.values()) {
    const he = [...new Set([...p.forms.he, ...(p.forms.he.size ? [p.rec.he] : [])])];
    const en = [...new Set([...p.forms.en, ...(p.rec.en ? [p.rec.en] : [])])];
    if (!he.length && p.rec.all) he.push(...p.rec.all.he);
    suggestions.push({
      kind: 'town', entity: { kind: 'town', he: [...new Set([...he, ...p.rec.all.he])], en: [...new Set([...en, ...p.rec.all.en])] },
      confidence: p.conf, reasons: [...p.reasons], mentions: p.occ.map((i) => ({ start: toks[i].start, end: toks[i].end })),
    });
  }
  for (const s of schools.values()) {
    const entity = { kind: 'school' };
    if (s.he) entity.he = s.he;
    if (s.en) entity.en = s.en;
    suggestions.push({ kind: 'school', entity, confidence: s.conf, reasons: ['school-head'], mentions: [] });
  }
  for (const { entityId, part, en } of spellingSuggestions.values()) {
    suggestions.push({ kind: 'spelling', entityId, part, entity: { en }, confidence: 'medium', reasons: ['transliteration'], mentions: [] });
  }
  for (const { entityId, nick } of nickSuggestions.values()) {
    suggestions.push({ kind: 'nickname', entityId, entity: /[\u05D0-\u05EA]/.test(nick) ? { he: nick } : { en: nick }, confidence: 'high', reasons: ['quoted-after-name'], mentions: [] });
  }
  return { suggestions };
}

// Convenience for "in a rush": accept every suggestion (or those passing
// `accept`), add them to the case, scrub.
export function autoScrub(text, kase, { accept = () => true } = {}) {
  const { suggestions } = suggest(text, kase);
  const chosen = suggestions.filter(accept);
  let k2 = kase;
  const ents = chosen.filter((s) => s.kind !== 'nickname' && s.kind !== 'spelling').map((s) => s.entity);
  if (ents.length) k2 = addEntities(k2, ents);
  for (const s of chosen.filter((x) => x.kind === 'nickname')) k2 = addNickname(k2, s.entityId, s.entity);
  for (const s of chosen.filter((x) => x.kind === 'spelling')) k2 = addSpelling(k2, s.entityId, s.part, 'en', s.entity.en);
  return { ...scrub(text, k2), suggestions };
}

const SETTLEMENT_HE = new Set(['מושב', 'קיבוץ', 'העיר', 'עיר', 'היישוב', 'הישוב', 'יישוב', 'ישוב', 'כפר', 'הכפר', 'המושב', 'הקיבוץ', 'מועצה', 'המועצה']);

const CUE_ADJ_HE = new Set(`הגדולה,הקטנה,הגדול,הקטן,הבכור,הבכורה,הצעיר,הצעירה,הבוגר,הבוגרת,התאום,התאומה,הקודם,
הקודמת,החדש,החדשה,הנוכחי,הנוכחית,הראשון,הראשונה,השני,השנייה,האמצעי,האמצעית,הביולוגי,הביולוגית,החורג,החורגת`.split(/[,\s]+/).filter(Boolean));

const VERB_MARKERS = new Set([...FEM_MARKERS, ...MASC_MARKERS].filter((w) => !/^(היא|הוא|בת|בן|ילדה|ילד|תלמידה|תלמיד|שלה|שלו|אותה|אותו|לה|לו|ממנה|ממנו|עצמה|עצמו|she|he|her|him|his|hers|herself|himself)$/.test(w)));

const COMMON_CAPS = new Set(`school,street,road,avenue,hospital,center,centre,clinic,university,college,department,
ministry,court,city,state,county,district,monday,tuesday,wednesday,thursday,friday,saturday,sunday,the,and,but,
she,he,they,her,his,their,this,that,dob,id,mother,father,teacher,client,patient,session,summary,contact,home,
scores,score,follow,referred,notes,note,wisc,vci,adhd,dsm,cbt,iq,ok,dr,mr,mrs,ms,elementary,high,middle,
kindergarten,academy,is,was,has,had,and,or,with,at,in,on,for,of,to,from,by,an,a,said,says,goes,attending,attend,
recommend,arrived,agrees,favourite,favorite,noted,may,will`.split(/[,\s]+/).filter(Boolean));

const COMMON_HE = new Set(`קשה,קל,טוב,טובה,רע,הרבה,מעט,נעים,שקט,רועש,מאוד,יותר,פחות,כמה,איזה,איזו,לומד,לומדת,לומדים,
שלו,שלה,יש,אין,היה,הייתה,היתה,שעות,שילוב,כיתה,כיתת,הם,הן,מנהל,מנהלת,מורה,מורים,ילדים,ילדות,הילדים,חדש,חדשה,
אחר,אחרת,קרוב,קרובה,רחוק,רחוקה,גדול,גדולה,קטן,קטנה,שם,כאן,פה,עכשיו,היום,אתמול,מחר,ביום`.split(/[,\s]+/).filter(Boolean));
