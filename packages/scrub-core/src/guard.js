// Leak guard primitives. buildGuard() turns cases into salted hashes that can
// be handed to the claude.ai page world; findLeaks() scans any outgoing body
// (JSON, form data, plain text) for them. The page world never receives a
// real identifier, only hashes and labels like "e1.first".
//
// Caveat (README threat model): names are low-entropy. Hashing keeps them out
// of logs, crash reports and casual inspection; it does not stop a page script
// that deliberately brute-forces a list of Israeli names against the salt.

import { sha256Hex } from './sha256.js';
import { normalizeForm, HE_PREFIXES, isHebrew } from './text.js';
import { normalizePhone, detectIds, detectEmails, detectPhones } from './detectors.js';
import { parseDates } from './dates.js';

// Split on script change so "וNoy" yields "ו" + "noy", not one token.
const WORD_RE = /[\p{sc=Hebrew}\p{M}]+(?:['׳"״][\p{sc=Hebrew}\p{M}]+)*|[\p{sc=Latin}\p{M}]+(?:['’][\p{sc=Latin}]+)*|[\p{L}\p{M}]+/gu;
const DIGIT_RUN_RE = /\+?\d[\d\s\-().]{3,}\d/g;
const EMAIL_RE = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g;

const h = (salt, s) => sha256Hex(salt + '\u0000' + s).slice(0, 32);

function words(s) {
  return [...normalizeForm(s).matchAll(WORD_RE)].map((m) => m[0]);
}

function entityForms(kase) {
  const out = [];
  for (const m of kase.mappings) {
    for (const f of [...m.real.he, ...m.real.en]) out.push({ form: f, label: `${m.entityId}.${m.part}` });
  }
  // Entities added after the last scrub have no mapping yet; guard them too.
  for (const e of kase.entities) {
    const push = (f, part) => f && [...f.he, ...f.en].forEach((s) => out.push({ form: s, label: `${e.id}.${part}` }));
    if (e.kind === 'person') { push(e.first, 'first'); push(e.last, 'last'); e.nicknames.forEach((n, i) => push(n, `nick${i}`)); }
    else push(e, 'name');
  }
  return out;
}

export function buildGuard(cases, salt) {
  if (!salt || salt.length < 16) throw new Error('buildGuard: salt must be at least 16 chars');
  const hashes = {};
  const lengths = new Set();
  for (const kase of cases) {
    for (const { form, label } of entityForms(kase)) {
      const w = words(form);
      if (!w.length) continue;
      lengths.add(w.length);
      hashes[h(salt, 'w:' + w.join(' '))] = label;
    }
    for (const r of Object.values(kase.redactions)) {
      if (r.kind === 'id' || r.kind === 'phone') {
        const d = r.kind === 'phone' ? normalizePhone(r.value) : r.value.replace(/\D/g, '').padStart(9, '0');
        hashes[h(salt, 'd:' + d)] = r.kind;
      } else if (r.kind === 'email') {
        hashes[h(salt, 'e:' + r.value.toLowerCase())] = 'email';
      }
    }
  }
  return { v: 1, salt, lengths: [...lengths].sort((a, b) => a - b), hashes };
}

// JSON bodies may escape non-ASCII ("נ"); decode before scanning.
function decodeEscapes(s) {
  return s.replace(/\\u([0-9a-fA-F]{4})/g, (_, x) => String.fromCharCode(parseInt(x, 16)));
}

function firstWordVariants(w) {
  const v = new Set([w]);
  const poss = w.replace(/['’]s$/, '');
  if (poss !== w) v.add(poss);
  if (isHebrew(w)) {
    for (const p of HE_PREFIXES) if (w.startsWith(p) && w.length - p.length >= 2) v.add(w.slice(p.length));
  }
  return [...v];
}

// Returns [{ label, index }] — empty means nothing declared was found.
// `patterns: true` also flags checksum-valid Israeli IDs, emails and IL phones
// that were never declared (the page can run these without any mapping).
export function findLeaks(body, guard, { patterns = true } = {}) {
  const text = decodeEscapes(String(body));
  const found = [];
  const seen = new Set();
  const hit = (key, index) => {
    const label = guard.hashes[h(guard.salt, key)];
    if (label && !seen.has(label + '@' + index)) { seen.add(label + '@' + index); found.push({ label, index }); }
  };

  const norm = text.normalize('NFC');
  // Month words inside a recognised date ("12 ביוני 2024") are not names,
  // even when a declared nickname is spelled like a month (יוני).
  const dateSpans = parseDates(norm).map((d) => [d.start, d.end]);
  const inDate = (i) => dateSpans.some(([a, b]) => i >= a && i < b);
  const toks = [...norm.matchAll(WORD_RE)].filter((m) => !inDate(m.index)).map((m) => ({ w: normalizeForm(m[0]), i: m.index }));
  for (let i = 0; i < toks.length; i++) {
    const firsts = firstWordVariants(toks[i].w);
    for (const n of guard.lengths) {
      if (i + n > toks.length) break;
      const rest = toks.slice(i + 1, i + n).map((t) => t.w);
      if (n === 1) { for (const f of firsts) hit('w:' + f, toks[i].i); continue; }
      // Only the first word of a multi-word name takes a prefix; only the last
      // takes a possessive.
      const last = rest[rest.length - 1];
      const lastVariants = [...new Set([last, last.replace(/['’]s$/, '')])];
      for (const f of firsts) {
        for (const lv of lastVariants) hit('w:' + [f, ...rest.slice(0, -1), lv].join(' '), toks[i].i);
      }
    }
  }

  for (const m of text.matchAll(DIGIT_RUN_RE)) {
    const d = normalizePhone(m[0]);
    hit('d:' + d, m.index);
    hit('d:' + d.padStart(9, '0'), m.index);
  }
  for (const m of text.matchAll(/\d+/g)) hit('d:' + m[0].padStart(9, '0'), m.index);
  for (const m of text.matchAll(EMAIL_RE)) hit('e:' + m[0].toLowerCase(), m.index);

  if (patterns) {
    for (const p of [...detectIds(text), ...detectEmails(text), ...detectPhones(text)]) {
      found.push({ label: 'pattern:' + p.kind, index: p.start });
    }
  }
  return found;
}
