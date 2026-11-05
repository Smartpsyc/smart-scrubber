// Cross-script consonant skeletons: does the English token "Valentina" spell
// the Hebrew name "ולנטינה"? Both reduce to B-L-N-T-N. Vowels and vowel
// letters are dropped; ambiguous letters (ו as v or a vowel, כ as k or ch,
// English "ch" as ח or כ, "z" as ז or צ) yield several skeletons, and two
// spellings match when their skeleton sets intersect.

const HE = {
  'ב': ['B'], 'ג': ['G'], 'ד': ['D'], 'ה': ['H', ''], 'ו': ['B', ''], 'ז': ['Z'], 'ח': ['H'], 'ט': ['T'],
  'י': [''], 'כ': ['K', 'H'], 'ך': ['H', 'K'], 'ל': ['L'], 'מ': ['M'], 'ם': ['M'], 'נ': ['N'], 'ן': ['N'],
  'ס': ['S'], 'ע': [''], 'פ': ['P'], 'ף': ['P'], 'צ': ['C'], 'ץ': ['C'], 'ק': ['K'], 'ר': ['R'], 'ש': ['S'],
  'ת': ['T'], 'א': [''],
};

function product(options, cap = 64) {
  let acc = [''];
  for (const opts of options) {
    const next = new Set();
    for (const a of acc) for (const o of opts) next.add(a + o);
    acc = [...next].slice(0, cap);
  }
  return acc;
}


export function heSkeletons(word) {
  const w = word.replace(/[֑-ׇ'׳"״\-\s]/g, '');
  const opts = [];
  for (let i = 0; i < w.length; i++) {
    const ch = w[i];
    let o = HE[ch] || [''];
    if (ch === 'ה' && i === w.length - 1) o = ['']; // final ה is a vowel
    if (ch === 'ו' && i === 0) o = ['B'];
    if (ch === 'ו' && w[i + 1] === 'ו') { opts.push(['B']); i++; continue; }
    if ((ch === 'ג' || ch === 'ז' || ch === 'צ') && /['׳]/.test(word[word.indexOf(ch) + 1] || '')) o = ch === 'ג' ? ['G'] : ch === 'ז' ? ['Z'] : ['H'];
    opts.push(o);
  }
  return product(opts).filter((s) => s.length >= 3);
}

export function enSkeletons(word) {
  // Doubled letters are one sound ("Hanna", "Greenwald" → n, not nn).
  const w = word.toLowerCase().replace(/[^a-z]/g, '').replace(/([a-z])\1+/g, '$1');
  const opts = [];
  for (let i = 0; i < w.length; i++) {
    const two = w.slice(i, i + 2);
    if (two === 'sh') { opts.push(['S']); i++; continue; }
    if (two === 'ch' || two === 'kh') { opts.push(['H', 'K']); i++; continue; }
    if (two === 'th') { opts.push(['T']); i++; continue; }
    if (two === 'ph') { opts.push(['P']); i++; continue; }
    if (two === 'tz' || two === 'ts') { opts.push(['C']); i++; continue; }
    if (two === 'ck') { opts.push(['K']); i++; continue; }
    const c = w[i];
    if ('aeiouy'.includes(c)) continue;
    if (c === 'b' || c === 'v' || c === 'w') opts.push(['B']);
    else if (c === 'g' || c === 'j') opts.push(['G']);
    else if (c === 'c') opts.push('eiy'.includes(w[i + 1] || '') ? ['S'] : ['K']);
    else if (c === 'k' || c === 'q') opts.push(['K']);
    else if (c === 'f' || c === 'p') opts.push(['P']);
    else if (c === 'z') opts.push(['Z', 'C']);
    else if (c === 'x') { opts.push(['K']); opts.push(['S']); }
    else if (c === 'h') opts.push(['H', '']);
    else if ('dlmnrst'.includes(c)) opts.push([c.toUpperCase()]);
  }
  return product(opts).filter((s) => s.length >= 3);
}

export function sameName(he, en) {
  const a = new Set(heSkeletons(he));
  if (!a.size) return false;
  return enSkeletons(en).some((s) => a.has(s));
}
