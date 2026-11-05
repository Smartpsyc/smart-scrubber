// scrub(): real text → text safe to send. restore(): Claude's reply → real names back.

import { allocate } from './case.js';
import { LABELS } from './pools.js';
import { detectPatterns } from './detectors.js';
import { parseDates, shiftValue, formatDate, valueKey } from './dates.js';
import {
  buildFormRegex, applyCase, contextScript, resolveOverlaps, applySpans, occursAsWord, isHebrew, escapeRe,
} from './text.js';

const REDACTION_KINDS = ['id', 'phone', 'email', 'url', 'address'];

function publicSpan(s) {
  const o = { start: s.start, end: s.end, outStart: s.outStart, outEnd: s.outEnd, kind: s.kind };
  if (s.mappingId) o.mappingId = s.mappingId;
  if (s.entityId) o.entityId = s.entityId;
  if (s.source) o.source = s.source;
  return o;
}

function mappingCandidates(text, kase) {
  const out = [];
  for (const m of kase.mappings) {
    for (const script of ['he', 'en']) {
      for (const form of m.real[script]) {
        for (const mt of text.matchAll(buildFormRegex(form))) {
          const g = mt.groups;
          out.push({
            start: mt.index, end: mt.index + mt[0].length, kind: m.kind, mappingId: m.id,
            entityId: m.entityId, pre: g.pre || '', hy: g.hy || '', core: g.core, script, priority: 100,
          });
        }
      }
    }
  }
  return out;
}

export function scrub(text, kase) {
  const { case: c, newMappings } = allocate(kase, text);
  const byId = new Map(c.mappings.map((m) => [m.id, m]));

  const cands = [
    ...mappingCandidates(text, c),
    ...detectPatterns(text),
    ...parseDates(text, { dateOrder: c.dateOrder }),
  ];
  const picked = resolveOverlaps(cands);
  const warnings = [];

  for (const s of picked) {
    if (s.mappingId) {
      const m = byId.get(s.mappingId);
      if (m.token) s.replacement = s.pre + s.hy + m.sur[contextScript(text, s.start, s.end)];
      else if (m.custom) s.replacement = s.pre + s.hy + m.sur[contextScript(text, s.start, s.end, { ignoreOwn: true })];
      else if (s.script === 'en') s.replacement = applyCase(s.core, m.sur.en);
      else s.replacement = s.pre + s.hy + m.sur.he;
      s.source = 'declared';
    } else if (REDACTION_KINDS.includes(s.kind)) {
      let r = c.redactions[s.key];
      if (!r) {
        c.counters[s.kind] = (c.counters[s.kind] || 0) + 1;
        r = c.redactions[s.key] = { kind: s.kind, n: c.counters[s.kind], value: s.value };
      }
      s.replacement = `[${LABELS[s.kind][contextScript(text, s.start, s.end)]} ${r.n}]`;
      s.source = 'pattern';
    } else if (s.kind === 'date') {
      const shifted = shiftValue(s.value, c.dateOffsetDays);
      const str = formatDate(shifted, s.fmt);
      const prev = c.dates.exact[str];
      if (prev !== undefined && prev !== s.raw) {
        warnings.push({ type: 'date-ambiguous', shifted: str });
      } else c.dates.exact[str] = s.raw;
      rememberDateValue(c, shifted, s.value);
      s.replacement = str;
      s.source = 'pattern';
    }
  }

  const { text: out, spans } = applySpans(text, picked);

  // A surrogate already present in the real text would be "restored" into a
  // real name later. Allocation avoids this for new mappings; older mappings
  // can still collide with a new message, so tell the caller.
  for (const m of c.mappings) {
    if (m.token || m.custom) continue;
    for (const f of [m.sur.he, m.sur.en]) {
      if (occursAsWord(text, f)) warnings.push({ type: 'surrogate-in-text', mappingId: m.id, surrogate: f });
    }
  }
  for (const m of newMappings) if (m.lossy) warnings.push({ type: 'nickname-shares-surrogate', mappingId: m.id });
  for (const m of newMappings) if (m.token && m.kind !== 'job' && m.kind !== 'other') warnings.push({ type: 'pool-exhausted', mappingId: m.id });

  // Self-check: no declared real form and no detectable pattern may survive.
  const residual = [];
  const outDates = parseDates(out, { dateOrder: c.dateOrder });
  const inDate = (a, b) => outDates.some((d) => a >= d.start && b <= d.end);
  for (const m of c.mappings) {
    for (const f of [...m.real.he, ...m.real.en]) {
      for (const mt of out.matchAll(buildFormRegex(f))) {
        if (!inDate(mt.index, mt.index + mt[0].length)) { residual.push({ kind: m.kind, mappingId: m.id, start: mt.index }); break; }
      }
    }
  }
  for (const p of detectPatterns(out)) residual.push({ kind: p.kind, start: p.start, end: p.end });

  return { text: out, spans: spans.map(publicSpan), newMappings, warnings, residual, case: c };
}

function rememberDateValue(c, shifted, original) {
  const set = (k, v) => { if (!(k in c.dates.values)) c.dates.values[k] = v; };
  set(valueKey(shifted), original);
  // Claude may restate a full date as "October 2023" or "October 17".
  if (shifted.k === 'ymd') {
    set(valueKey({ k: 'ym', y: shifted.y, m: shifted.m }), { k: 'ym', y: original.y, m: original.m });
    set(valueKey({ k: 'md', m: shifted.m, d: shifted.d }), { k: 'md', m: original.m, d: original.d });
  }
}

const TOKEN_RE = (() => {
  const labels = [];
  for (const k of REDACTION_KINDS) labels.push(LABELS[k].he, LABELS[k].en);
  return new RegExp(`\\[(${labels.map(escapeRe).join('|')})\\s+(\\d+)\\]`, 'giu');
})();

function kindForLabel(label) {
  const l = label.toLowerCase();
  return REDACTION_KINDS.find((k) => LABELS[k].he === label || LABELS[k].en.toLowerCase() === l);
}

export function restore(text, kase) {
  const c = kase;
  const cands = [];

  for (const m of c.mappings) {
    for (const script of ['he', 'en']) {
      const surForm = m.sur[script];
      if (!surForm) continue;
      const other = script === 'he' ? 'en' : 'he';
      const target = m.real[script][0] ?? m.real[other][0];
      if (!target) continue;
      const priority = m.lossy ? 50 : 100;
      if (m.token) {
        const re = new RegExp(escapeRe(surForm), script === 'en' ? 'giu' : 'gu');
        for (const mt of text.matchAll(re)) {
          cands.push({ start: mt.index, end: mt.index + mt[0].length, kind: m.kind, mappingId: m.id, entityId: m.entityId, replacement: target, priority });
        }
        continue;
      }
      for (const mt of text.matchAll(buildFormRegex(surForm))) {
        const g = mt.groups;
        let replacement;
        if (script === 'he') {
          const pre = g.pre || '';
          const hy = g.hy || (pre && !isHebrew(target) ? '-' : '');
          replacement = pre + hy + target;
        } else {
          replacement = isHebrew(target) ? target : applyCase(g.core, target);
        }
        cands.push({ start: mt.index, end: mt.index + mt[0].length, kind: m.kind, mappingId: m.id, entityId: m.entityId, replacement, priority });
      }
    }
  }

  const unresolved = [];
  for (const mt of text.matchAll(TOKEN_RE)) {
    const kind = kindForLabel(mt[1]);
    const n = Number(mt[2]);
    const r = Object.values(c.redactions).find((x) => x.kind === kind && x.n === n);
    if (!r) { unresolved.push(mt[0]); continue; }
    cands.push({ start: mt.index, end: mt.index + mt[0].length, kind, replacement: r.value, priority: 90 });
  }

  for (const d of parseDates(text, { dateOrder: c.dateOrder })) {
    const exact = c.dates.exact[d.raw];
    if (exact !== undefined) {
      cands.push({ ...d, replacement: exact, priority: 20 });
      continue;
    }
    const orig = c.dates.values[valueKey(d.value)];
    if (orig) cands.push({ ...d, replacement: formatDate(orig, d.fmt), priority: 20, reformatted: true });
  }

  const { text: out, spans } = applySpans(text, resolveOverlaps(cands));
  return { text: out, spans: spans.map(publicSpan), unresolved };
}

// Replacement key for a UI legend: "Avigail = Noa". Local only, never sent.
export function legend(kase) {
  return kase.mappings.map((m) => ({
    mappingId: m.id, entityId: m.entityId, kind: m.kind, part: m.part,
    real: m.real.he[0] ?? m.real.en[0], surrogate: { ...m.sur },
  }));
}
