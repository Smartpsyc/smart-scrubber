// Pattern detectors for identifiers that are redacted (never surrogated):
// Israeli ID (checksum-gated), phones, email, URL, street address.
// Each returns candidates { start, end, kind, value, key, priority }.

export function isValidIsraeliId(raw) {
  const d = String(raw).replace(/\D/g, '');
  if (d.length < 5 || d.length > 9) return false;
  const s = d.padStart(9, '0');
  if (/^0+$/.test(s)) return false;
  let sum = 0;
  for (let i = 0; i < 9; i++) {
    let n = Number(s[i]) * ((i % 2) + 1);
    if (n > 9) n -= 9;
    sum += n;
  }
  return sum % 10 === 0;
}

export function normalizePhone(raw) {
  let d = raw.replace(/\D/g, '');
  if (d.startsWith('972')) d = '0' + d.slice(3);
  return d;
}

const ID_CUE = /(?:ת\.?\s?ז\.?|ת[״"]ז|תעודת\s+זהות|מספר\s+זהות|\bI\.?D\.?|Teudat\s+Zehut)\s*(?:מס['׳]?|no\.?|number|#)?\s*[:\-]?\s*$/iu;

function* matchAll(re, text) {
  re.lastIndex = 0;
  let m;
  while ((m = re.exec(text))) {
    yield m;
    if (m[0].length === 0) re.lastIndex++;
  }
}

export function detectIds(text) {
  const out = [];
  // 9 digits, or 8+1 with a dash before the check digit.
  const re = /(?<!\d)(?<!\d[\-.])(\d{8})-?(\d)(?![\d])|(?<!\d)(?<!\d[\-.])(\d{5,8})(?![\d\-])/g;
  for (const m of matchAll(re, text)) {
    const digits = m[1] ? m[1] + m[2] : m[3];
    if (!m[1]) {
      // Shorter than 9 digits: only with an explicit ID cue right before it.
      if (!ID_CUE.test(text.slice(Math.max(0, m.index - 24), m.index))) continue;
    }
    if (!isValidIsraeliId(digits)) continue;
    out.push({
      start: m.index, end: m.index + m[0].length, kind: 'id',
      value: m[0], key: 'id:' + digits.padStart(9, '0'), priority: 50,
    });
  }
  return out;
}

export function detectPhones(text) {
  const out = [];
  const il = /(?<![\d+])(?:\+972[\s-]?|972[\s-]?|\(?0)(?:[23489]|5\d|7\d)\)?[\s-]?\d{3}[\s-]?\d{4}(?![\d])/g;
  for (const m of matchAll(il, text)) {
    out.push({
      start: m.index, end: m.index + m[0].length, kind: 'phone',
      value: m[0], key: 'phone:' + normalizePhone(m[0]), priority: 45,
    });
  }
  const intl = /(?<![\d+])\+(?!972)\d{1,3}(?:[\s-]?\(?\d{1,4}\)?){2,5}(?![\d])/g;
  for (const m of matchAll(intl, text)) {
    const digits = m[0].replace(/\D/g, '');
    if (digits.length < 8 || digits.length > 15) continue;
    out.push({
      start: m.index, end: m.index + m[0].length, kind: 'phone',
      value: m[0], key: 'phone:' + digits, priority: 45,
    });
  }
  return out;
}

export function detectEmails(text) {
  const out = [];
  const re = /(?<![A-Za-z0-9._%+-])[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}(?![A-Za-z])/g;
  for (const m of matchAll(re, text)) {
    out.push({
      start: m.index, end: m.index + m[0].length, kind: 'email',
      value: m[0], key: 'email:' + m[0].toLowerCase(), priority: 60,
    });
  }
  return out;
}

export function detectUrls(text) {
  const out = [];
  const re = /(?<![\w@])(?:https?:\/\/|www\.)[^\s<>"'\])]+/gi;
  for (const m of matchAll(re, text)) {
    const v = m[0].replace(/[.,;:!?״"']+$/u, '');
    out.push({
      start: m.index, end: m.index + v.length, kind: 'url',
      value: v, key: 'url:' + v.toLowerCase(), priority: 55,
    });
  }
  return out;
}

export function detectAddresses(text) {
  const out = [];
  // Hebrew: (ב|ל|מ|ו)?רחוב/רח'/שדרות/שד'/סמטת + 1–4 words + house number.
  // The prefix clitic stays outside the redaction ("ב[כתובת 1]").
  const he = /(?<![\p{L}\p{M}])(?:ו?[בלמ])?((?:רחוב|רח['׳]|שדרות|שד['׳]|סמטת)\s+[א-ת'׳"״\-]+(?:\s+[א-ת'׳"״\-]+){0,3}\s+\d{1,4}[א-ת]?)(?![\d\p{L}])/gu;
  for (const m of matchAll(he, text)) {
    const start = m.index + m[0].length - m[1].length;
    out.push({
      start, end: m.index + m[0].length, kind: 'address',
      value: m[1], key: 'address:' + m[1].replace(/\s+/g, ' '), priority: 40,
    });
  }
  const en = /\b\d{1,5}\s+(?:[A-Z][a-z]+\.?\s+){1,3}(?:Street|Avenue|Road|Boulevard|Lane|Drive|Court|Place|(?:St|Ave|Rd|Blvd|Ln|Ct|Pl)\b\.?)/g;
  for (const m of matchAll(en, text)) {
    out.push({
      start: m.index, end: m.index + m[0].length, kind: 'address',
      value: m[0], key: 'address:' + m[0].replace(/\s+/g, ' ').toLowerCase(), priority: 40,
    });
  }
  return out;
}

export function detectPatterns(text) {
  return [
    ...detectIds(text), ...detectPhones(text), ...detectEmails(text),
    ...detectUrls(text), ...detectAddresses(text),
  ];
}
