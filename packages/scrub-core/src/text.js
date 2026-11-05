// Script-aware text helpers: Hebrew prefix clitics, niqqud-tolerant patterns,
// word boundaries, casing. No DOM, no globals beyond String/RegExp.

export const HEB_LETTER_RE = /[א-ת]/;
const HEB_LETTER_G = /[א-ת]/g;
const LAT_LETTER_G = /[A-Za-z]/g;

// Word boundaries. Hebrew points/cantillation are \p{M}, so a word is
// letters + marks + digits.
export const B_BEFORE = '(?<![\\p{L}\\p{M}\\p{N}])';
export const B_AFTER = '(?![\\p{L}\\p{M}\\p{N}])';
// For Latin-script forms only Latin letters join a word, so "לNoa" / "וNoy"
// (Hebrew prefix glued to an English name) still match.
const L_BEFORE = '(?<![\\p{sc=Latin}\\p{M}\\p{N}])';
const L_AFTER = '(?![\\p{sc=Latin}\\p{M}\\p{N}])';

// Hebrew prefix clitics: ו + (ש|כש|מש|לכש) + (ה|ב|כ|ל|מ), every non-empty
// combination, longest first so the regex alternation prefers full prefixes.
const PRE_A = ['', 'ו'];
const PRE_B = ['', 'ש', 'כש', 'מש', 'לכש'];
const PRE_C = ['', 'ה', 'ב', 'כ', 'ל', 'מ'];
export const HE_PREFIXES = (() => {
  const set = new Set();
  for (const a of PRE_A) for (const b of PRE_B) for (const c of PRE_C) {
    const p = a + b + c;
    if (p) set.add(p);
  }
  return [...set].sort((x, y) => y.length - x.length);
})();
export const HE_PREFIX_ALT = HE_PREFIXES.join('|');
const HYPHEN_CLASS = '[-־‐–]';

export function escapeRe(s) {
  return s.replace(/[.*+?^${}()|[\]\\/]/g, '\\$&');
}

export function isHebrew(s) {
  return HEB_LETTER_RE.test(s);
}

// Character-by-character pattern that tolerates niqqud between letters and
// treats geresh/gershayim/apostrophe/quote variants and whitespace runs as equal.
export function formPattern(form) {
  let out = '';
  for (const ch of form.normalize('NFC')) {
    if (/\p{M}/u.test(ch)) continue; // declared form's own niqqud is optional
    if (/['׳’`]/.test(ch)) out += "['׳’`]";
    else if (/["״”“]/.test(ch)) out += '["״”“]';
    else if (/\s/.test(ch)) out += '[\\s\\u00A0]+';
    else if (/[-־‐–]/.test(ch)) out += HYPHEN_CLASS;
    else out += escapeRe(ch) + (isHebrew(ch) ? '\\p{M}*' : '');
  }
  return out;
}

// Matcher for one surface form.
// Hebrew: optional prefix clitic + optional hyphen, captured so the
// replacement can carry the same prefix. English: case-insensitive.
export function buildFormRegex(form) {
  const core = formPattern(form);
  if (isHebrew(form)) {
    return new RegExp(
      `${B_BEFORE}(?:(?<pre>${HE_PREFIX_ALT})(?<hy>${HYPHEN_CLASS})?)?(?<core>${core})${B_AFTER}`,
      'gu',
    );
  }
  return new RegExp(`${L_BEFORE}(?<core>${core})${L_AFTER}`, 'giu');
}

// Normalization used for equality checks and leak hashes.
export function normalizeForm(s) {
  return s
    .normalize('NFC')
    .replace(/\p{M}/gu, '')
    .replace(/['׳’`]/g, "'")
    .replace(/["״”“]/g, '"')
    .replace(/[-־‐–]/g, '-')
    .replace(/[\s ]+/g, ' ')
    .trim()
    .toLowerCase();
}

// Carry the casing of the matched English text over to the replacement.
export function applyCase(matched, replacement) {
  if (!/[A-Za-z]/.test(matched)) return replacement;
  if (matched.length > 1 && matched === matched.toUpperCase()) return replacement.toUpperCase();
  if (matched === matched.toLowerCase()) return replacement.toLowerCase();
  return replacement;
}

// Which script dominates around [start, end): decides the language of
// redaction labels like [טלפון 1] vs [PHONE 1].
export function contextScript(text, start, end, { radius = 60, ignoreOwn = false } = {}) {
  // A span with its own letters ("רחוב הרצל 12") speaks for itself, unless
  // the caller wants the surrounding sentence's language (custom replacements).
  const own = text.slice(start, end);
  if (!ignoreOwn) {
    if (HEB_LETTER_RE.test(own)) return 'he';
    if (/[A-Za-z]{2,}/.test(own) && !/[@/]/.test(own)) return 'en';
  }
  const count = (s) => [(s.match(HEB_LETTER_G) || []).length, (s.match(LAT_LETTER_G) || []).length];
  // Look at the span's own sentence, capped at `radius` characters each side.
  let a = Math.max(0, start - radius);
  let b = Math.min(text.length, end + radius);
  const before = text.slice(a, start);
  const cut = Math.max(before.lastIndexOf('. '), before.lastIndexOf('\n'), before.lastIndexOf('! '), before.lastIndexOf('? '));
  if (cut >= 0) a += cut + 1;
  const after = text.slice(end, b);
  const stop = after.search(/[.!?](\s|$)|\n/);
  if (stop >= 0) b = end + stop;
  const win = text.slice(a, start) + ' ' + text.slice(end, b);
  let [he, la] = count(win);
  if (!he && !la) [he, la] = count(text.slice(0, start) + text.slice(end));
  if (!he && !la) return isHebrew(own) ? 'he' : 'en';
  return he >= la ? 'he' : 'en';
}

// Does `form` occur in `text` as a word (Hebrew: possibly with a prefix)?
export function occursAsWord(text, form) {
  const re = buildFormRegex(form);
  return re.test(text);
}

// Pick non-overlapping spans: longest first, then priority, then earliest.
export function resolveOverlaps(cands) {
  const sorted = [...cands].sort(
    (a, b) => (b.end - b.start) - (a.end - a.start) || (b.priority || 0) - (a.priority || 0) || a.start - b.start,
  );
  const picked = [];
  for (const c of sorted) {
    if (picked.some((p) => c.start < p.end && p.start < c.end)) continue;
    picked.push(c);
  }
  return picked.sort((a, b) => a.start - b.start);
}

// Apply picked spans (each with .replacement) to text; returns output and
// spans annotated with output offsets.
export function applySpans(text, picked) {
  let out = '';
  let pos = 0;
  const spans = [];
  for (const s of picked) {
    out += text.slice(pos, s.start);
    const outStart = out.length;
    out += s.replacement;
    spans.push({ ...s, outStart, outEnd: out.length });
    pos = s.end;
  }
  out += text.slice(pos);
  return { text: out, spans };
}
