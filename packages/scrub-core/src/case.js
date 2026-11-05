// A "case" is everything needed to scrub and restore one clinical
// conversation: declared entities, the surrogates allocated for them, numbered
// redactions, and the date offset. It is plain JSON (the extension stores it
// encrypted). Functions here never mutate their input.

import { POOLS, SCHOOL_HEADS_HE, SCHOOL_HEADS_EN, SCHOOL_TAILS_EN, LABELS, COMMUNITIES } from './pools.js';
import { hash32, mulberry32, seededShuffle, randomSeed } from './rng.js';
import { pickDateOffset } from './dates.js';
import { isHebrew, normalizeForm, occursAsWord, formPattern } from './text.js';

export const ENTITY_KINDS = ['person', 'town', 'school', 'job', 'other'];
const GENDERS = ['f', 'm', 'x'];

const toList = (v) => (v == null ? [] : (Array.isArray(v) ? v : [v]))
  .map((s) => String(s).trim()).filter(Boolean);

function formsOf(obj) {
  return { he: toList(obj && obj.he), en: toList(obj && obj.en) };
}

// Accept a loose form ({he: 'נועה'} or {he: ['נועה'], en: 'Noa'}) and check scripts.
function cleanForms(obj, where) {
  const f = formsOf(obj);
  for (const s of f.he) if (!isHebrew(s)) throw new Error(`${where}: "${s}" is listed as Hebrew but has no Hebrew letters`);
  for (const s of f.en) if (isHebrew(s)) throw new Error(`${where}: "${s}" is listed as English but contains Hebrew`);
  return f;
}

export function normalizeEntity(e, id) {
  if (!e || !ENTITY_KINDS.includes(e.kind)) throw new Error(`entity kind must be one of ${ENTITY_KINDS.join(', ')}`);
  const out = { id: e.id || id, kind: e.kind };
  if (e.role) out.role = String(e.role);
  if (e.community != null) {
    if (!COMMUNITIES.includes(e.community)) throw new Error(`${out.id}: community must be one of ${COMMUNITIES.join(', ')}`);
    out.community = e.community;
  }
  if (e.kind === 'person') {
    out.gender = GENDERS.includes(e.gender) ? e.gender : 'x';
    out.first = cleanForms(e.first, `${out.id}.first`);
    if (e.last) out.last = cleanForms(e.last, `${out.id}.last`);
    const hasLast = out.last && (out.last.he.length || out.last.en.length);
    if (!out.first.he.length && !out.first.en.length && !hasLast) throw new Error(`${out.id}: a person needs a first name or a surname`);
    out.nicknames = (e.nicknames || []).map((n, i) => cleanForms(n, `${out.id}.nicknames[${i}]`))
      .filter((n) => n.he.length || n.en.length);
  } else {
    const f = cleanForms(e, out.id);
    if (!f.he.length && !f.en.length) throw new Error(`${out.id}: needs at least one spelling`);
    out.he = f.he;
    out.en = f.en;
    if (e.replacement && (e.kind === 'job' || e.kind === 'other')) {
      const r = { he: toList(e.replacement.he)[0], en: toList(e.replacement.en)[0] };
      if (r.he || r.en) out.replacement = { he: r.he || r.en, en: r.en || r.he };
    }
  }
  return out;
}

export function createCase({ entities = [], seed, dateOffsetDays, dateOrder = 'DMY', community = 'general' } = {}) {
  if (!COMMUNITIES.includes(community)) throw new Error(`community must be one of ${COMMUNITIES.join(', ')}`);
  const s = seed || randomSeed();
  const kase = {
    v: 1,
    seed: s,
    dateOffsetDays: Number.isInteger(dateOffsetDays) ? dateOffsetDays : pickDateOffset(mulberry32(hash32(s + '|date'))),
    dateOrder,
    community,
    entities: [],
    mappings: [],
    redactions: {},
    counters: {},
    dates: { exact: {}, values: {} },
  };
  return addEntities(kase, entities);
}

export function addEntities(kase, entities) {
  const next = structuredClone(kase);
  let n = next.entities.length;
  for (const e of entities) {
    let id;
    do { id = `e${++n}`; } while (next.entities.some((x) => x.id === id));
    const ent = normalizeEntity(e, id);
    if (next.entities.some((x) => x.id === ent.id)) throw new Error(`duplicate entity id ${ent.id}`);
    next.entities.push(ent);
  }
  return next;
}

// Attach a nickname to an existing person (auto mode: 'Yonatan goes by "Yoni"').
export function addNickname(kase, entityId, nick) {
  const next = structuredClone(kase);
  const e = next.entities.find((x) => x.id === entityId && x.kind === 'person');
  if (!e) throw new Error(`no person ${entityId}`);
  const f = cleanForms(nick, `${entityId}.nickname`);
  const all = [...e.first.he, ...e.first.en, ...e.nicknames.flatMap((n) => [...n.he, ...n.en])].map(normalizeForm);
  if ([...f.he, ...f.en].some((s) => all.includes(normalizeForm(s)))) return next;
  e.nicknames.push(f);
  return next;
}

// Add another spelling to a declared entity part (auto mode: "Valentina"
// found for the Hebrew-declared ולנטינה). Updates an existing mapping too,
// so the new spelling is scrubbed with the same surrogate.
export function addSpelling(kase, entityId, part, script, form) {
  const next = structuredClone(kase);
  const e = next.entities.find((x) => x.id === entityId);
  if (!e) throw new Error(`no entity ${entityId}`);
  if ((script === 'he') !== isHebrew(form)) throw new Error(`"${form}" is not ${script}`);
  const target = part === 'first' ? e.first : part === 'last' ? e.last : part.startsWith('nick') ? e.nicknames[Number(part.slice(4))] : e;
  if (!target) throw new Error(`${entityId} has no ${part}`);
  const has = (list) => list.some((s) => normalizeForm(s) === normalizeForm(form));
  if (!has(target[script])) target[script].push(form);
  for (const m of next.mappings) if (m.entityId === entityId && m.part === part && !has(m.real[script])) m.real[script].push(form);
  return next;
}

export function removeEntity(kase, entityId) {
  const next = structuredClone(kase);
  next.entities = next.entities.filter((e) => e.id !== entityId);
  // Mappings stay so earlier replies still restore.
  return next;
}

// ---------- allocation ----------

function nextCounter(kase, label) {
  kase.counters[label] = (kase.counters[label] || 0) + 1;
  return kase.counters[label];
}

function tokenFor(kase, labelKey) {
  const n = nextCounter(kase, labelKey);
  const L = LABELS[labelKey];
  return { he: `[${L.he} ${n}]`, en: `[${L.en} ${n}]` };
}

function allDeclaredReal(kase) {
  const set = new Set();
  const add = (f) => { for (const s of [...f.he, ...f.en]) set.add(normalizeForm(s)); };
  for (const e of kase.entities) {
    if (e.kind === 'person') { add(e.first); if (e.last) add(e.last); e.nicknames.forEach(add); }
    else add(e);
  }
  return set;
}

function usedSurrogates(kase) {
  const set = new Set();
  for (const m of kase.mappings) {
    set.add(normalizeForm(m.sur.he));
    set.add(normalizeForm(m.sur.en));
  }
  return set;
}

function splitSchool(form, script) {
  if (script === 'he') {
    for (const h of SCHOOL_HEADS_HE) {
      const m = new RegExp(`^(${formPattern(h)})[\\s\\u00A0]+(.+)$`, 'u').exec(form);
      if (m) return { head: m[1], core: m[2].trim(), tail: '' };
    }
    return { head: '', core: form, tail: '' };
  }
  const lower = form.toLowerCase();
  for (const h of SCHOOL_HEADS_EN) {
    if (lower.startsWith(h.toLowerCase()) && form.length > h.length) {
      return { head: form.slice(0, h.length).trim(), core: form.slice(h.length).trim(), tail: '' };
    }
  }
  for (const t of SCHOOL_TAILS_EN) {
    if (lower.endsWith(t.toLowerCase()) && form.length > t.length) {
      return { head: '', core: form.slice(0, form.length - t.length).trim(), tail: form.slice(form.length - t.length).trim() };
    }
  }
  return { head: '', core: form, tail: '' };
}

const joinParts = (head, core, tail) => [head, core, tail].filter(Boolean).join(' ');

// Is a candidate surrogate (all its surface forms) safe to use in this case?
function makeAcceptor(kase, text) {
  const used = usedSurrogates(kase);
  const real = allDeclaredReal(kase);
  return (forms) => forms.every((f) => {
    const n = normalizeForm(f);
    if (used.has(n) || real.has(n)) return false;
    // A surrogate must not already appear in the text it will be mixed into,
    // and must not contain/be contained by a declared real form.
    for (const r of real) if (n.includes(r) || r.includes(n)) return false;
    return !occursAsWord(text, f);
  });
}

function pickFromPool(pool, seedKey, accept, needDims = 0) {
  const order = seededShuffle(pool, seedKey);
  const formsOfEntry = (e, k) => [e.he, e.en, ...e.dims.slice(0, k).flatMap((d) => [d.he, d.en])];
  if (needDims > 0) {
    const withDims = order.find((e) => e.dims.length >= needDims && accept(formsOfEntry(e, needDims)));
    if (withDims) return withDims;
  }
  return order.find((e) => accept(formsOfEntry(e, Math.min(needDims, e.dims.length)))) || null;
}

const scriptOfForms = (f) => (f.he.length ? 'he' : 'en');

// Arab community → Arab pool; otherwise Hebrew-declared → Israeli pool,
// English-only → English-native pool.
function poolFor(kase, e, forms) {
  if ((e.community || kase.community) === 'arab') return POOLS.ar;
  return POOLS[scriptOfForms(forms)];
}

function findReusable(kase, kind, part, forms) {
  const wanted = new Set([...forms.he, ...forms.en].map(normalizeForm));
  return kase.mappings.find((m) => m.kind === kind && m.part === part
    && [...m.real.he, ...m.real.en].some((s) => wanted.has(normalizeForm(s))));
}

// Allocate surrogates for every declared entity part that has none yet.
// `text` is the text about to be scrubbed (collision check).
export function allocate(kase, text = '') {
  const next = structuredClone(kase);
  const newMappings = [];
  const add = (m) => {
    m.id = `m${next.mappings.length + 1}`;
    next.mappings.push(m);
    newMappings.push(m);
  };
  const has = (entityId, part) => next.mappings.some((m) => m.entityId === entityId && m.part === part);
  const seedKey = (e, part) => `${next.seed}|${e.id}|${part}`;

  for (const e of next.entities) {
    if (e.kind === 'person') {
      const pool = poolFor(next, e, e.first.he.length || e.first.en.length ? e.first : e.last);
      const hasFirst = e.first.he.length || e.first.en.length;
      if (hasFirst && !has(e.id, 'first')) {
        const reuse = findReusable(next, 'person', 'first', e.first);
        if (reuse) {
          add({ entityId: e.id, part: 'first', kind: 'person', gender: e.gender, real: e.first, sur: { ...reuse.sur }, token: reuse.token, dims: reuse.dims || [] });
        } else {
          const accept = makeAcceptor(next, text);
          const pick = pickFromPool(pool.first[e.gender], seedKey(e, 'first'), accept, e.nicknames.length);
          if (pick) add({ entityId: e.id, part: 'first', kind: 'person', gender: e.gender, real: e.first, sur: { he: pick.he, en: pick.en }, token: false, dims: pick.dims });
          else add({ entityId: e.id, part: 'first', kind: 'person', gender: e.gender, real: e.first, sur: tokenFor(next, 'person'), token: true, dims: [] });
        }
      }
      const firstMap = next.mappings.find((m) => m.entityId === e.id && m.part === 'first');
      if (firstMap) e.nicknames.forEach((nick, i) => {
        const part = `nick${i}`;
        if (has(e.id, part)) return;
        const d = firstMap.dims && firstMap.dims[i];
        const accept = makeAcceptor(next, text);
        if (d && accept([d.he, d.en])) { add({ entityId: e.id, part, kind: 'person', real: nick, sur: { he: d.he, en: d.en }, token: false }); return; }
        // No matching diminutive: give the nickname its own same-gender name.
        // In context ('קוראים לאוריה "ליאת"') it still reads as a nickname,
        // and restore stays exact.
        const other = !firstMap.token && pickFromPool(pool.first[e.gender], seedKey(e, part), accept);
        if (other) add({ entityId: e.id, part, kind: 'person', real: nick, sur: { he: other.he, en: other.en }, token: false });
        // Pool exhausted: share the first name's surrogate (restore returns the first name).
        else add({ entityId: e.id, part, kind: 'person', real: nick, sur: { ...firstMap.sur }, token: firstMap.token, lossy: true });
      });
      if (e.last && (e.last.he.length || e.last.en.length) && !has(e.id, 'last')) {
        // Family members share a surname: same real surname → same surrogate.
        const reuse = findReusable(next, 'person', 'last', e.last);
        if (reuse) add({ entityId: e.id, part: 'last', kind: 'person', real: e.last, sur: { ...reuse.sur }, token: reuse.token });
        else {
          const pick = pickFromPool(poolFor(next, e, e.last).last, seedKey(e, 'last'), makeAcceptor(next, text));
          add({ entityId: e.id, part: 'last', kind: 'person', real: e.last, sur: pick ? { he: pick.he, en: pick.en } : tokenFor(next, 'last'), token: !pick });
        }
      }
      continue;
    }

    if (e.kind === 'town') {
      if (has(e.id, 'name')) continue;
      const pick = pickFromPool(poolFor(next, e, e).town, seedKey(e, 'name'), makeAcceptor(next, text));
      add({ entityId: e.id, part: 'name', kind: 'town', real: { he: e.he, en: e.en }, sur: pick ? { he: pick.he, en: pick.en } : tokenFor(next, 'town'), token: !pick });
      continue;
    }

    if (e.kind === 'school') {
      if (has(e.id, 'name')) continue;
      const he = e.he.map((f) => splitSchool(f, 'he'));
      const en = e.en.map((f) => splitSchool(f, 'en'));
      const pick = pickFromPool(poolFor(next, e, e).school, seedKey(e, 'name'), makeAcceptor(next, text));
      if (!pick) {
        add({ entityId: e.id, part: 'name', kind: 'school', real: { he: e.he, en: e.en }, sur: tokenFor(next, 'school'), token: true });
        continue;
      }
      const heHead = (he.find((p) => p.head) || {}).head || '';
      const enHead = (en.find((p) => p.head) || {}).head || '';
      const enTail = (en.find((p) => p.tail) || {}).tail || '';
      add({
        entityId: e.id, part: 'name', kind: 'school', real: { he: e.he, en: e.en },
        sur: { he: joinParts(heHead, pick.he, ''), en: joinParts(enHead, pick.en, enTail) }, token: false,
      });
      // The distinctive part alone ("אלונים" in "בית הספר אלונים") is matched too.
      const coreHe = he.filter((p) => p.head).map((p) => p.core);
      const coreEn = en.filter((p) => p.head || p.tail).map((p) => p.core);
      if (coreHe.length || coreEn.length) {
        add({ entityId: e.id, part: 'core', kind: 'school', real: { he: coreHe, en: coreEn }, sur: { he: pick.he, en: pick.en }, token: false });
      }
      continue;
    }

    // job / other: the clinician's own replacement text, or a numbered token.
    if (has(e.id, 'name')) continue;
    if (e.replacement) {
      add({ entityId: e.id, part: 'name', kind: e.kind, real: { he: e.he, en: e.en }, sur: { ...e.replacement }, token: false, custom: true });
    } else {
      add({ entityId: e.id, part: 'name', kind: e.kind, real: { he: e.he, en: e.en }, sur: tokenFor(next, e.kind === 'job' ? 'job' : 'other'), token: true });
    }
  }
  return { case: next, newMappings };
}
