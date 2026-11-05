// Date detection, shifting and re-formatting.
//
// Every date is shifted by one per-case offset (a whole number of weeks, so
// weekdays stay right: school days and Shabbat matter in clinical notes).
// Intervals and ages are preserved. The output keeps the input's format.
//
// Value kinds: 'ymd' (full date), 'ym' (month + year), 'md' (day + month, no year).
// Numeric day/month without a year ("7/10") is never touched: it is far more
// often a score than a date. Year-only is never touched either.

export const HE_MONTHS = [
  ['ינואר'], ['פברואר'], ['מרץ', 'מרס'], ['אפריל'], ['מאי'], ['יוני'],
  ['יולי'], ['אוגוסט'], ['ספטמבר'], ['אוקטובר'], ['נובמבר'], ['דצמבר'],
];
export const EN_MONTHS = [
  ['January', 'Jan'], ['February', 'Feb'], ['March', 'Mar'], ['April', 'Apr'], ['May'],
  ['June', 'Jun'], ['July', 'Jul'], ['August', 'Aug'], ['September', 'Sept', 'Sep'],
  ['October', 'Oct'], ['November', 'Nov'], ['December', 'Dec'],
];

const heMonthAlt = HE_MONTHS.flat().sort((a, b) => b.length - a.length).join('|');
const enMonthAlt = EN_MONTHS.flat().sort((a, b) => b.length - a.length).join('|');

function heMonthIndex(s) { return HE_MONTHS.findIndex((v) => v.includes(s)); }
function enMonthIndex(s) { return EN_MONTHS.findIndex((v) => v.includes(s)); }

function validYmd(y, m, d) {
  if (m < 1 || m > 12 || d < 1) return false;
  const dim = new Date(Date.UTC(y, m, 0)).getUTCDate();
  return d <= dim;
}

function year4(yStr) {
  if (yStr.length === 4) return Number(yStr);
  const n = Number(yStr);
  return n >= 50 ? 1900 + n : 2000 + n;
}

const pad = (n, on) => (on ? String(n).padStart(2, '0') : String(n));
const isPadded = (s) => s.length === 2 && s[0] === '0';

function ordinal(d) {
  if (d % 100 >= 11 && d % 100 <= 13) return 'th';
  return ({ 1: 'st', 2: 'nd', 3: 'rd' })[d % 10] || 'th';
}

function* matchAll(re, text) {
  re.lastIndex = 0;
  let m;
  while ((m = re.exec(text))) yield m;
}

// ---------- parse ----------

export function parseDates(text, { dateOrder = 'DMY' } = {}) {
  const out = [];
  const push = (m, value, fmt, start = m.index, end = m.index + m[0].length) => {
    out.push({ start, end, kind: 'date', value, fmt, raw: text.slice(start, end), priority: 10 });
  };

  // ISO 2024-03-12
  for (const m of matchAll(/(?<!\d)(?<!\d[./-])(\d{4})-(\d{1,2})-(\d{1,2})(?![\d]|[./-]\d)/g, text)) {
    const y = +m[1], mo = +m[2], d = +m[3];
    if (!validYmd(y, mo, d)) continue;
    push(m, { k: 'ymd', y, m: mo, d }, { t: 'iso', mp: isPadded(m[2]) || m[2].length === 2, dp: isPadded(m[3]) || m[3].length === 2 });
  }

  // 12/03/2024, 12.3.24, 12-03-2024 (day-first by default)
  for (const m of matchAll(/(?<!\d)(?<!\d[./-])(\d{1,2})([./-])(\d{1,2})\2(\d{4}|\d{2})(?![\d]|[./-]\d)/g, text)) {
    const a = +m[1], b = +m[3], y = year4(m[4]);
    let order = dateOrder;
    if (a > 12 && b <= 12) order = 'DMY';
    else if (b > 12 && a <= 12) order = 'MDY';
    const [d, mo] = order === 'DMY' ? [a, b] : [b, a];
    if (!validYmd(y, mo, d)) continue;
    // Zero-padding is a writer's habit: if either part is padded, pad both.
    const p = isPadded(m[1]) || isPadded(m[3]);
    push(m, { k: 'ymd', y, m: mo, d }, { t: 'num', order, sep: m[2], ap: p, bp: p, yl: m[4].length });
  }

  // 03/2024 (month/year, 4-digit year only)
  for (const m of matchAll(/(?<!\d)(?<!\d[./-])(\d{1,2})([./])((?:19|20)\d{2})(?![\d]|[./-]\d)/g, text)) {
    const mo = +m[1];
    if (mo < 1 || mo > 12) continue;
    push(m, { k: 'ym', y: +m[3], m: mo }, { t: 'numym', sep: m[2], mp: isPadded(m[1]) });
  }

  // Hebrew: 12 במרץ 2024 / 12 למרץ / 12 מרץ, 2024
  const heDay = new RegExp(`(?<![\\d])(\\d{1,2})(\\s+)([בל]?)(-?)(${heMonthAlt})(?:(,?\\s+)(\\d{4}))?(?![\\p{L}\\p{M}\\d])`, 'gu');
  for (const m of matchAll(heDay, text)) {
    const d = +m[1], mo = heMonthIndex(m[5]) + 1;
    const fmt = { t: 'he', dp: isPadded(m[1]), s1: m[2], pre: m[3], hy: m[4], mname: m[5], s2: m[6] || '' };
    if (m[7]) {
      const y = +m[7];
      if (!validYmd(y, mo, d)) continue;
      push(m, { k: 'ymd', y, m: mo, d }, fmt);
    } else {
      if (!validYmd(2000, mo, d)) continue;
      push(m, { k: 'md', m: mo, d }, fmt);
    }
  }
  // Hebrew month + year: (ב)מרץ 2024
  const heYm = new RegExp(`(?<![\\p{L}\\p{M}\\d])([בלמ]?)(-?)(${heMonthAlt})(,?\\s+)((?:19|20)\\d{2})(?![\\d])`, 'gu');
  for (const m of matchAll(heYm, text)) {
    const mo = heMonthIndex(m[3]) + 1;
    const start = m.index + m[1].length + m[2].length; // prefix stays outside
    push(m, { k: 'ym', y: +m[5], m: mo }, { t: 'heym', mname: m[3], s: m[4] }, start);
  }

  // English month-first: March 12, 2024 / Mar. 12th / March 12
  const enMd = new RegExp(`(?<![\\p{L}])(${enMonthAlt})(\\.?)(\\s+)(\\d{1,2})(st|nd|rd|th)?(?:(,?\\s+)(\\d{4}))?(?![\\d\\p{L}])`, 'gu');
  for (const m of matchAll(enMd, text)) {
    const mo = enMonthIndex(m[1]) + 1, d = +m[4];
    const fmt = { t: 'enmd', mname: m[1], dot: m[2], s1: m[3], dp: isPadded(m[4]), ord: !!m[5], s2: m[6] || '' };
    if (m[7]) {
      const y = +m[7];
      if (!validYmd(y, mo, d)) continue;
      push(m, { k: 'ymd', y, m: mo, d }, fmt);
    } else {
      if (!validYmd(2000, mo, d)) continue;
      push(m, { k: 'md', m: mo, d }, fmt);
    }
  }
  // English day-first: 12 March 2024 / 12th of March
  const enDm = new RegExp(`(?<![\\d])(\\d{1,2})(st|nd|rd|th)?(\\s+)(of\\s+)?(${enMonthAlt})(\\.?)(?:(,?\\s+)(\\d{4}))?(?![\\d\\p{L}])`, 'gu');
  for (const m of matchAll(enDm, text)) {
    const d = +m[1], mo = enMonthIndex(m[5]) + 1;
    const fmt = { t: 'endm', dp: isPadded(m[1]), ord: !!m[2], s1: m[3], of: m[4] || '', mname: m[5], dot: m[6], s2: m[7] || '' };
    if (m[8]) {
      const y = +m[8];
      if (!validYmd(y, mo, d)) continue;
      push(m, { k: 'ymd', y, m: mo, d }, fmt);
    } else {
      if (!validYmd(2000, mo, d)) continue;
      push(m, { k: 'md', m: mo, d }, fmt);
    }
  }
  // English month + year: March 2024
  const enYm = new RegExp(`(?<![\\p{L}])(${enMonthAlt})(\\.?)(,?\\s+)((?:19|20)\\d{2})(?![\\d])`, 'gu');
  for (const m of matchAll(enYm, text)) {
    push(m, { k: 'ym', y: +m[4], m: enMonthIndex(m[1]) + 1 }, { t: 'enym', mname: m[1], dot: m[2], s: m[3] });
  }

  return out;
}

// ---------- shift ----------

const DAY = 86400000;

export function shiftValue(v, days) {
  if (v.k === 'ymd') {
    const t = new Date(Date.UTC(v.y, v.m - 1, v.d) + days * DAY);
    return { k: 'ymd', y: t.getUTCFullYear(), m: t.getUTCMonth() + 1, d: t.getUTCDate() };
  }
  if (v.k === 'md') {
    // Leap reference year so Feb 29 survives; the year itself is discarded.
    const t = new Date(Date.UTC(2000, v.m - 1, v.d) + days * DAY);
    return { k: 'md', m: t.getUTCMonth() + 1, d: t.getUTCDate() };
  }
  const months = monthShift(days);
  const idx = v.y * 12 + (v.m - 1) + months;
  return { k: 'ym', y: Math.floor(idx / 12), m: (idx % 12) + 1 };
}

export function monthShift(days) {
  return Math.round(days / 30.44);
}

export function valueKey(v) {
  if (v.k === 'ymd') return `ymd:${v.y}-${v.m}-${v.d}`;
  if (v.k === 'ym') return `ym:${v.y}-${v.m}`;
  return `md:${v.m}-${v.d}`;
}

// ---------- format ----------

// Month name in the same "style" (full / abbreviation / alt spelling) as the source.
function heMonthName(mo, src) {
  const forms = HE_MONTHS[mo - 1];
  const srcForms = HE_MONTHS.find((v) => v.includes(src)) || [];
  const i = srcForms.indexOf(src);
  return forms[Math.min(Math.max(i, 0), forms.length - 1)];
}
function enMonthName(mo, src) {
  const forms = EN_MONTHS[mo - 1];
  const srcForms = EN_MONTHS.find((v) => v.includes(src)) || [];
  const i = srcForms.indexOf(src);
  const full = i === 0 || src === 'May';
  if (full) return forms[0];
  // abbreviation: prefer the same length as the source (Sept vs Sep), else shortest
  const abbrs = forms.slice(1);
  if (!abbrs.length) return forms[0];
  return abbrs.find((a) => a.length === src.length) || abbrs[abbrs.length - 1];
}

export function formatDate(v, fmt) {
  switch (fmt.t) {
    case 'iso':
      return `${v.y}-${pad(v.m, fmt.mp)}-${pad(v.d, fmt.dp)}`;
    case 'num': {
      const [a, b] = fmt.order === 'DMY' ? [v.d, v.m] : [v.m, v.d];
      const y = fmt.yl === 2 ? String(v.y % 100).padStart(2, '0') : String(v.y);
      return `${pad(a, fmt.ap)}${fmt.sep}${pad(b, fmt.bp)}${fmt.sep}${y}`;
    }
    case 'numym':
      return `${pad(v.m, fmt.mp)}${fmt.sep}${v.y}`;
    case 'he': {
      const base = `${pad(v.d, fmt.dp)}${fmt.s1}${fmt.pre}${fmt.hy}${heMonthName(v.m, fmt.mname)}`;
      return v.k === 'ymd' ? `${base}${fmt.s2 || ' '}${v.y}` : base;
    }
    case 'heym':
      return `${heMonthName(v.m, fmt.mname)}${fmt.s}${v.y}`;
    case 'enmd': {
      const mname = enMonthName(v.m, fmt.mname);
      const dot = mname === EN_MONTHS[v.m - 1][0] ? '' : fmt.dot;
      const base = `${mname}${dot}${fmt.s1}${pad(v.d, fmt.dp)}${fmt.ord ? ordinal(v.d) : ''}`;
      return v.k === 'ymd' ? `${base}${fmt.s2 || ', '}${v.y}` : base;
    }
    case 'endm': {
      const mname = enMonthName(v.m, fmt.mname);
      const dot = mname === EN_MONTHS[v.m - 1][0] ? '' : fmt.dot;
      const base = `${pad(v.d, fmt.dp)}${fmt.ord ? ordinal(v.d) : ''}${fmt.s1}${fmt.of}${mname}${dot}`;
      return v.k === 'ymd' ? `${base}${fmt.s2 || ' '}${v.y}` : base;
    }
    case 'enym': {
      const mname = enMonthName(v.m, fmt.mname);
      const dot = mname === EN_MONTHS[v.m - 1][0] ? '' : fmt.dot;
      return `${mname}${dot}${fmt.s}${v.y}`;
    }
    default:
      throw new Error('unknown date format ' + fmt.t);
  }
}

// Random non-zero offset, whole weeks, at least 5 weeks so month/year
// dates move too. Range ±5..52 weeks.
export function pickDateOffset(rnd) {
  const weeks = 5 + Math.floor(rnd() * 48);
  return (rnd() < 0.5 ? -1 : 1) * weeks * 7;
}
