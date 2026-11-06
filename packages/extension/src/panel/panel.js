// Side panel: the only place real identifiers are ever shown.
// Real text → scrub-core → only the scrubbed text goes to the claude.ai tab.
// Replies come back only when the clinician asks (button or paste box).

import {
  createCase, addEntities, removeEntity, scrub, restore, legend, autoScrub,
} from '../vendor/scrub-core/index.js';
import { STRINGS, pickLang } from './i18n.js';
import * as store from './store.js';
import { extractFile } from './files.js';

const $ = (id) => document.getElementById(id);
const isHe = (s) => /[֐-׿]/.test(s);
const ROLES = ['client', 'mother', 'father', 'sibling', 'partner', 'child', 'teacher', 'clinician', 'other'];
const KIND_ICON = { person: '👤', town: '📍', school: '🏫', job: '💼', other: '•' };

const S = {
  lang: 'en',
  t: STRINGS.en,
  settings: null,
  tab: null,            // chrome.tabs.Tab of the claude.ai tab we drive
  health: null,         // last health reply from the adapter (or { ok:false, reason })
  caseId: null,         // conversation uuid, or "draft-tab<id>" before the first send
  rec: null,            // { kase, mode, compose, createdAt }
  caseNotice: null,
  unticked: new Set(),  // auto-mode suggestion keys the clinician unticked
  genders: new Map(),   // auto-mode suggestion key → 'f' | 'm'
  suggestions: [],
  preview: null,        // last scrub()/autoScrub() result for the compose text
  restored: null,       // { text, spans, unresolved }
  busy: false,          // an insert is in flight
};

// ---------- helpers ----------

function el(tag, attrs = {}, ...kids) {
  const n = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v == null || v === false) continue;
    if (k === 'class') n.className = v;
    else if (k.startsWith('on')) n.addEventListener(k.slice(2), v);
    else n.setAttribute(k, v === true ? '' : v);
  }
  for (const c of kids.flat()) if (c != null) n.append(c);
  return n;
}

function debounce(fn, ms) {
  let t;
  return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); };
}

// Render text with <mark>s over [start,end) ranges (ranges must not overlap).
function marked(text, ranges) {
  const frag = document.createDocumentFragment();
  let at = 0;
  for (const r of [...ranges].sort((a, b) => a.start - b.start)) {
    if (r.start < at) continue;
    frag.append(text.slice(at, r.start));
    frag.append(el('mark', { class: `k-${r.kind}`, title: r.title || null }, text.slice(r.start, r.end)));
    at = r.end;
  }
  frag.append(text.slice(at));
  return frag;
}

function setMsg(id, text, isErr = false) {
  const n = $(id);
  n.textContent = text || '';
  n.classList.toggle('err', isErr === true);
  n.classList.toggle('warn', isErr === 'warn');
}

const errText = (reason) => S.t.err[reason] || S.t.err.error;

// ---------- language ----------

function applyLang() {
  S.t = STRINGS[S.lang];
  document.documentElement.lang = S.lang;
  document.documentElement.dir = S.lang === 'he' ? 'rtl' : 'ltr';
  for (const n of document.querySelectorAll('[data-i18n]')) n.textContent = S.t[n.dataset.i18n] ?? '';
  for (const n of document.querySelectorAll('[data-i18n-ph]')) n.placeholder = S.t[n.dataset.i18nPh] ?? '';
  for (const n of document.querySelectorAll('[data-i18n-title]')) n.title = S.t[n.dataset.i18nTitle] ?? '';
  for (const n of document.querySelectorAll('[data-i18n-aria]')) n.setAttribute('aria-label', S.t[n.dataset.i18nAria] ?? '');
  $('lang').textContent = S.t.langToggle;
  const role = $('role-select');
  const current = role.value || 'client';
  role.replaceChildren(...ROLES.map((r) => el('option', { value: r }, S.t.roles[r])));
  role.value = current;
  renderAll();
}

// ---------- the claude.ai tab ----------

async function findTargetTab() {
  const patterns = chrome.runtime.getManifest().host_permissions;
  const [active] = await chrome.tabs.query({ active: true, currentWindow: true, url: patterns });
  if (active) return active;
  const win = (await chrome.windows.getCurrent()).id;
  const all = await chrome.tabs.query({ url: patterns });
  all.sort((a, b) => (b.windowId === win) - (a.windowId === win) || (b.lastAccessed || 0) - (a.lastAccessed || 0));
  return all[0] || null;
}

async function ask(cmd, extra = {}) {
  if (!S.tab) return { ok: false, reason: 'no-tab' };
  try {
    const r = await chrome.tabs.sendMessage(S.tab.id, { ns: 'scrubber', cmd, ...extra });
    return r || { ok: false, reason: 'no-script' };
  } catch {
    return { ok: false, reason: 'no-script' };
  }
}

// Serialized: the timer, tab events and button clicks all call this.
let refreshChain = Promise.resolve();
function refreshTarget() {
  refreshChain = refreshChain.then(doRefresh, doRefresh).catch(() => {});
  return refreshChain;
}

async function doRefresh() {
  S.tab = await findTargetTab();
  S.health = S.tab ? await ask('health') : { ok: false, reason: 'no-tab' };
  renderStatus();
  const conv = S.health.conversationId || null;
  if (S.tab && (S.health.ok || S.health.reason === 'loading')) await bindCase(conv);
  else if (!S.rec) await bindCase(null);
}

// ---------- case binding & persistence ----------

function freshRecord() {
  return {
    kase: createCase({ community: S.settings.community || 'general' }),
    mode: 'auto', // quick by default: paste and click; Manual is under Check and adjust
    compose: '',
    createdAt: Date.now(),
  };
}

async function bindCase(conversationId) {
  const draftId = `draft-tab${S.tab ? S.tab.id : 'none'}`;
  const id = conversationId || draftId;
  if (id === S.caseId) return;
  // A new chat just got its id (the clinician sent in Claude): the draft case
  // that anonymized the article becomes this conversation's case.
  if (conversationId && S.caseId === draftId && S.rec && S.rec.used
      && (await store.loadCase(conversationId)).status === 'missing') {
    S.caseId = conversationId;
    await persistNow();
    await store.deleteCase(draftId);
    renderAll();
    return;
  }
  if (S.caseId && S.rec) await persistNow();
  const r = await store.loadCase(id);
  S.caseNotice = null;
  if (r.status === 'ok') S.rec = r.data;
  else {
    S.rec = freshRecord();
    if (r.status === 'undecryptable') S.caseNotice = 'caseRestoredWarn';
  }
  S.caseId = id;
  S.restored = null;
  S.unticked.clear();
  S.genders.clear();
  $('compose').value = S.rec.compose || '';
  recompute();
  renderAll();
}

async function persistNow() {
  if (S.caseId && S.rec) await store.saveCase(S.caseId, S.rec);
}
const persistSoon = debounce(() => persistNow().catch(() => {}), 600);

// ---------- scrubbing ----------

// A school's he/en is a string; a town's is a list.
const oneOf = (v) => (Array.isArray(v) ? v[0] : v) || '';

function sugKey(s) {
  const e = s.entity || {};
  const first = (x) => (x && (x.he?.[0] || x.en?.[0])) || '';
  return [s.kind, s.entityId || '', first(e.first), first(e.last), oneOf(e.he), oneOf(e.en)].join('|');
}

function recompute() {
  const text = S.rec ? S.rec.compose : '';
  S.preview = null;
  S.suggestions = [];
  if (!text.trim()) return;
  try {
    if (S.rec.mode === 'auto') {
      const r = autoScrub(text, S.rec.kase, {
        accept: (s) => {
          const k = sugKey(s);
          if (S.unticked.has(k)) return false;
          if (s.kind === 'person' && S.genders.has(k)) s.entity.gender = S.genders.get(k);
          return true;
        },
      });
      S.preview = r;
      S.suggestions = r.suggestions;
    } else {
      S.preview = scrub(text, S.rec.kase);
    }
  } catch (e) {
    S.preview = { error: String(e && e.message || e) };
  }
}

const recomputeSoon = debounce(() => { recompute(); renderCompose(); }, 250);

// ---------- rendering ----------

function renderAll() {
  renderStatus();
  renderCase();
  renderCompose();
 
  renderRestored();
}

function renderStatus() {
  const n = $('status');
  const h = S.health;
  let key = 'stConnected', ok = true;
  if (!S.tab) { key = 'stNoTab'; ok = false; }
  else if (!h || !h.ok) {
    ok = false;
    key = h && h.reason === 'no-script' ? 'stNoScript' : h && h.reason === 'loading' ? 'stLoading' : 'stPaused';
  }
  n.textContent = S.t[key];
  n.className = `status ${ok ? 'ok' : 'bad'}`;
  renderSendButton();
}

function renderCase() {
  if (!S.rec) return;
  const notice = $('case-notice');
  notice.hidden = !S.caseNotice;
  notice.textContent = S.caseNotice ? S.t[S.caseNotice] : '';

  for (const b of document.querySelectorAll('.seg button')) b.setAttribute('aria-checked', String(b.dataset.mode === S.rec.mode));
  $('mode-hint').textContent = S.rec.mode === 'auto' ? S.t.modeAutoHint : S.t.modeManualHint;

  const sur = new Map();
  for (const l of legend(S.rec.kase)) if (!sur.has(l.entityId)) sur.set(l.entityId, l.surrogate[S.lang] || l.surrogate.he || l.surrogate.en);
  const list = $('entities');
  const items = S.rec.kase.entities.map((e) => {
    const name = e.kind === 'person'
      ? [e.first.he[0] || e.first.en[0], e.last && (e.last.he[0] || e.last.en[0])].filter(Boolean).join(' ')
      : (e.he[0] || e.en[0]);
    const g = e.kind === 'person' ? (e.gender === 'f' ? '♀ ' : e.gender === 'm' ? '♂ ' : '') : '';
    const role = e.role && S.t.roles[e.role] ? ` · ${S.t.roles[e.role]}` : '';
    return el('li', { 'data-entity': e.id },
      `${KIND_ICON[e.kind]} ${g}${name}${role}`,
      sur.has(e.id) ? el('span', { class: 'sur' }, `→ ${sur.get(e.id)}`) : null,
      el('button', { type: 'button', class: 'x', 'aria-label': `${S.t.remove} ${name}`, onclick: () => onRemoveEntity(e.id) }, '×'));
  });
  list.replaceChildren(...(items.length ? items : [el('li', { class: 'empty' }, S.t.nothingDeclared)]));
  const modeLabel = S.rec.mode === 'auto' ? S.t.modeAuto : S.t.modeManual;
  $('people-count').textContent = `${items.length ? `(${items.length})` : S.t.noneYet} · ${modeLabel}`;
  showFieldsFor($('add-kind').value);
}

function renderCompose() {
  const text = S.rec ? S.rec.compose : '';
  const p = S.preview;
  const preview = $('preview');
  const out = $('outgoing');
  const residual = $('residual');
  residual.hidden = true;
  residual.className = 'notice danger';

  if (!p) { preview.replaceChildren(text); out.replaceChildren(); }
  else if (p.error) {
    preview.replaceChildren(text);
    out.replaceChildren();
    residual.hidden = false;
    residual.textContent = p.error;
  } else {
    const ranges = p.spans.map((s) => ({ start: s.start, end: s.end, kind: s.kind, title: `→ ${p.text.slice(s.outStart, s.outEnd)}` }));
    if (S.rec.mode === 'auto') {
      for (const s of S.suggestions) {
        if (!S.unticked.has(sugKey(s))) continue;
        for (const m of s.mentions || []) ranges.push({ start: m.start, end: m.end, kind: 'suggest' });
      }
    }
    preview.replaceChildren(marked(text, ranges));
    out.replaceChildren(marked(p.text, p.spans.map((s) => ({ start: s.outStart, end: s.outEnd, kind: s.kind }))));
    const clash = p.warnings.filter((w) => w.type === 'surrogate-in-text').map((w) => w.surrogate);
    if (clash.length) {
      residual.hidden = false;
      residual.className = 'notice warn';
      residual.textContent = `${S.t.warnSurrogate} ${[...new Set(clash)].join(', ')}`;
    }
    if (p.residual.length) {
      // A warning, not a block: the clinician decides.
      residual.className = 'notice warn';
      residual.hidden = false;
      residual.replaceChildren(S.t.residual, el('ul', {}, p.residual.map((r) =>
        el('li', {}, `${r.kind}: ${p.text.slice(r.start, r.end ?? r.start + 12)}`))));
    }
  }

  // Folded headers carry the status, so a closed fold still says where things stand.
  const words = text.trim() ? text.trim().split(/\s+/).length : 0;
  $('article-count').textContent = words ? S.t.wordsN.replace('{n}', words.toLocaleString()) : S.t.emptyArticle;
  const nRepl = p && !p.error ? p.spans.length : 0;
  $('preview-count').textContent = nRepl ? S.t.replaceN.replace('{n}', nRepl) : '';
  const wrap = $('suggestions-wrap');
  wrap.hidden = !(S.rec && S.rec.mode === 'auto' && text.trim());
  const nFound = S.suggestions.filter((s) => s.kind !== 'spelling' && !S.unticked.has(sugKey(s))).length;
  $('found-count').textContent = wrap.hidden ? '' : `(${nFound})`;
  // A hidden fold can't stay open.
  if (wrap.hidden && wrap.open) wrap.open = false;
  const more = [];
  if (!wrap.hidden) more.push(S.t.foundN.replace('{n}', nFound));
  if (nRepl) more.push(S.t.replaceN.replace('{n}', nRepl));
  $('more-count').textContent = more.join(' · ');
  if (!wrap.hidden) {
    const chips = S.suggestions.filter((s) => s.kind !== 'spelling').map((s) => {
      const k = sugKey(s);
      const off = S.unticked.has(k);
      const e = s.entity;
      const label = s.kind === 'person'
        ? [e.first?.he?.[0] || e.first?.en?.[0], e.last?.he?.[0] || e.last?.en?.[0]].filter(Boolean).join(' ')
        : s.kind === 'nickname' ? (e.he || e.en) : oneOf(e.he) || oneOf(e.en);
      const g = S.genders.get(k) || e.gender;
      const genderBtns = s.kind === 'person' && (s.needsGender || S.genders.has(k)) ? [
        el('button', { type: 'button', class: 'g', 'aria-pressed': String(g === 'f'), onclick: () => setSugGender(k, 'f') }, '♀'),
        el('button', { type: 'button', class: 'g', 'aria-pressed': String(g === 'm'), onclick: () => setSugGender(k, 'm') }, '♂'),
      ] : [];
      return el('li', { class: off ? 'off' : null, 'data-suggestion': k },
        el('input', { type: 'checkbox', checked: !off, 'aria-label': label, onchange: () => toggleSug(k) }),
        `${KIND_ICON[s.kind] || KIND_ICON.person} ${label}`,
        ...genderBtns,
        s.needsGender && !S.genders.has(k) ? el('span', { class: 'sur' }, S.t.needsGender) : null);
    });
    $('suggestions').replaceChildren(...(chips.length ? chips : [el('li', { class: 'empty' }, S.t.noSuggestions)]));
  }
  renderSendButton();
}

// Committing needs an anonymized text (leftovers only warn); putting it into Claude also needs the page.
function canCommit() {
  return !!(S.preview && !S.preview.error && !S.busy);
}

function renderSendButton() {
  $('insert').disabled = !(canCommit() && S.health && S.health.ok);
  $('copy-out').disabled = !canCommit();
}

function renderRestored() {
  const r = S.restored;
  $('restored-wrap').hidden = !r;
  if (!r) return;
  $('restored').replaceChildren(marked(r.text, r.spans.map((s) => ({ start: s.outStart, end: s.outEnd, kind: s.kind }))));
  const un = $('unresolved');
  un.hidden = !r.unresolved.length;
  un.textContent = r.unresolved.length ? `${S.t.unresolved} ${[...new Set(r.unresolved)].join(', ')}` : '';
}

// ---------- actions ----------

function showFieldsFor(kind) {
  for (const f of document.querySelectorAll('#add-form .fields[data-for]')) f.hidden = !f.dataset.for.split(' ').includes(kind);
}

function forms(primary, other) {
  const out = { he: [], en: [] };
  for (const v of [primary, other]) {
    const s = (v || '').trim();
    if (s) out[isHe(s) ? 'he' : 'en'].push(s);
  }
  return out;
}

function entityFromForm(fd) {
  const kind = fd.get('kind');
  if (kind === 'person') {
    const e = {
      kind, gender: fd.get('gender'), role: fd.get('role'),
      first: forms(fd.get('first'), fd.get('firstOther')),
      nicknames: String(fd.get('nicknames') || '').split(/[,،]/).map((s) => s.trim()).filter(Boolean)
        .map((s) => (isHe(s) ? { he: s } : { en: s })),
    };
    const last = forms(fd.get('last'), fd.get('lastOther'));
    if (last.he.length || last.en.length) e.last = last;
    return e;
  }
  if (kind === 'town' || kind === 'school') return { kind, ...forms(fd.get('place'), fd.get('placeOther')) };
  const [val, rep] = kind === 'job' ? [fd.get('job'), fd.get('jobReplace')] : [fd.get('other'), fd.get('otherReplace')];
  const e = { kind, ...forms(val) };
  const r = String(rep || '').trim();
  if (r) e.replacement = isHe(r) ? { he: r } : { en: r };
  return e;
}

function addEntity(entity) {
  try {
    S.rec.kase = addEntities(S.rec.kase, [entity]);
  } catch (e) {
    setMsg('add-error', String(e.message || e), true);
    return false;
  }
  setMsg('add-error', '');
  recompute();
  renderCase(); renderCompose();
  persistNow().catch(() => {});
  return true;
}

async function onAddSubmit(ev) {
  ev.preventDefault();
  const form = ev.currentTarget;
  const fd = new FormData(form);
  fd.set('kind', $('add-kind').value);
  if (addEntity(entityFromForm(fd))) {
    for (const i of form.querySelectorAll('input')) i.value = '';
    form.querySelector('.fields:not([hidden]) input')?.focus();
  }
}

async function onRemoveEntity(id) {
  S.rec.kase = removeEntity(S.rec.kase, id);
  recompute();
  renderCase(); renderCompose();
  await persistNow();
}

function toggleSug(k) {
  if (S.unticked.has(k)) S.unticked.delete(k); else S.unticked.add(k);
  recompute(); renderCompose();
}

function setSugGender(k, g) {
  S.genders.set(k, g);
  recompute(); renderCompose();
}

// The case that produced these stand-ins is the one that must restore them,
// so it is saved the moment the anonymized text leaves the panel.
async function commit(result) {
  S.rec.kase = result.case;
  S.rec.used = true;
  S.rec.compose = '';
  $('compose').value = '';
  S.unticked.clear();
  S.genders.clear();
  await persistNow();
  recompute();
  renderAll();
}

function freshResult() {
  recompute(); // never use a stale preview
  renderCompose();
  return canCommit() ? S.preview : null;
}

async function onInsert() {
  const result = freshResult();
  if (!result || !(S.health && S.health.ok)) return;
  S.busy = true;
  renderSendButton();
  setMsg('send-msg', '');
  try {
    const r = await ask('insert', { text: result.text });
    if (!r.ok) { setMsg('send-msg', errText(r.reason), true); return; }
    await commit(result);
    setMsg('send-msg', r.how === 'attachment' ? S.t.insertedAttachment : S.t.inserted);
    advance();
  } finally {
    S.busy = false;
    renderSendButton();
  }
}

async function onCopyOut() {
  const result = freshResult();
  if (!result) return;
  await navigator.clipboard.writeText(result.text);
  await commit(result);
  setMsg('send-msg', S.t.copiedOut);
  advance();
}

// After the article goes out, the clinician works in Claude: show the key and restore.
function advance() {
  $('step2').open = true;
}

// ---------- files (read locally; see files.js) ----------

async function loadFile(file) {
  if (!file || !S.rec) return;
  setMsg('file-msg', S.t.fileReading);
  let r;
  try {
    r = await extractFile(file, ({ page, pages }) => setMsg('file-msg', S.t.fileReadingScan.replace('{n}', page).replace('{total}', pages)));
  } catch (e) {
    setMsg('file-msg', S.t.fileErr[e.message] || S.t.fileErr.unreadable, true);
    return;
  }
  const cur = $('compose').value.trim();
  const text = cur ? `${cur}\n\n${r.text}` : r.text;
  $('compose').value = text;
  S.rec.compose = text;
  persistSoon();
  recompute();
  renderCompose();
 
  if (r.ocr) setMsg('file-msg', S.t.fileLoadedScan.replace('{name}', file.name), 'warn');
  else setMsg('file-msg', S.t.fileLoaded.replace('{name}', file.name));
}

async function onBringBack() {
  setMsg('restore-msg', '');
  await refreshTarget();
  const r = await ask('readLast');
  if (!r.ok) { setMsg('restore-msg', errText(r.reason), true); return; }
  S.restored = restore(r.text, S.rec.kase);
  $('step2').open = true;
  renderRestored();
}

function onRestorePaste() {
  const text = $('paste').value;
  if (!text.trim()) return;
  S.restored = restore(text, S.rec.kase);
  renderRestored();
}

async function onCopy() {
  if (!S.restored) return;
  await navigator.clipboard.writeText(S.restored.text);
  const b = $('copy');
  b.textContent = S.t.copied;
  setTimeout(() => { b.textContent = S.t.copy; }, 1500);
}

function onExport() {
  if (!S.restored) return;
  const url = URL.createObjectURL(new Blob([S.restored.text], { type: 'text/markdown;charset=utf-8' }));
  const a = el('a', { href: url, download: `restored-${new Date().toISOString().slice(0, 10)}.md` });
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

// ---------- tag-a-word ----------

let tagText = '';

function onPreviewSelect() {
  const menu = $('tag-menu');
  const sel = window.getSelection();
  const text = sel && sel.toString().replace(/\s+/g, ' ').trim();
  if (!text || text.length > 60 || !$('preview').contains(sel.anchorNode)) { menu.hidden = true; return; }
  tagText = text;
  const rect = sel.getRangeAt(0).getBoundingClientRect();
  menu.hidden = false;
  menu.style.top = `${Math.min(rect.bottom + 6, window.innerHeight - menu.offsetHeight - 8)}px`;
  menu.style.insetInlineStart = '12px';
}

async function onTag(kind) {
  $('tag-menu').hidden = true;
  const words = tagText.split(' ');
  const f = (s) => (isHe(s) ? { he: s } : { en: s });
  let e;
  if (kind === 'f' || kind === 'm') {
    e = { kind: 'person', gender: kind, first: f(words[0]) };
    if (words.length > 1) e.last = f(words.slice(1).join(' '));
  } else {
    e = { kind, ...f(tagText) };
  }
  addEntity(e);
  window.getSelection()?.removeAllRanges();
}

// ---------- settings ----------

async function openSettings() {
  $('retention').value = S.settings.retentionDays;
  $('community').value = S.settings.community || 'general';
  setMsg('settings-msg', '');
  $('settings').showModal();
}

async function onSettingsChange() {
  const days = Math.max(1, Math.min(365, Number($('retention').value) || 30));
  const community = $('community').value;
  S.settings = await store.setSettings({ retentionDays: days, community });
  // A case that hasn't allocated anything yet can still switch pools.
  if (S.rec && !S.rec.kase.mappings.length && S.rec.kase.community !== community) {
    S.rec.kase = { ...S.rec.kase, community };
    recompute(); renderAll();
    await persistNow();
  }
}

async function onDeleteCase() {
  if (!S.caseId || !confirm(S.t.deleteConfirm)) return;
  await store.deleteCase(S.caseId);
  S.rec = freshRecord();
  $('compose').value = '';
  S.restored = null;
  recompute();
  renderAll();
  setMsg('settings-msg', S.t.deleted);
}

// ---------- boot ----------

async function boot() {
  S.settings = await store.getSettings();
  S.lang = pickLang(S.settings.lang);
  await store.sweep(S.settings.retentionDays).catch(() => {});
  $('disclaimer').hidden = !!S.settings.disclaimerAck;

  $('lang').addEventListener('click', async () => {
    S.lang = S.lang === 'he' ? 'en' : 'he';
    S.settings = await store.setSettings({ lang: S.lang });
    applyLang();
  });
  $('disclaimer-ok').addEventListener('click', async () => {
    S.settings = await store.setSettings({ disclaimerAck: true });
    $('disclaimer').hidden = true;
  });
  for (const b of document.querySelectorAll('.seg button')) {
    b.addEventListener('click', async () => {
      S.rec.mode = b.dataset.mode;
      recompute(); renderCase(); renderCompose();
      await persistNow();
    });
  }
  $('add-kind').addEventListener('change', (e) => showFieldsFor(e.target.value));
  $('add-form').addEventListener('submit', onAddSubmit);
  $('compose').addEventListener('input', (e) => {
    S.rec.compose = e.target.value;
    persistSoon();
    recomputeSoon();
  });
  $('insert').addEventListener('click', onInsert);
  $('file-btn').addEventListener('click', () => $('file').click());
  $('file').addEventListener('change', (e) => { loadFile(e.target.files[0]); e.target.value = ''; });
  for (const zone of [$('drop'), $('compose')]) {
    zone.addEventListener('dragover', (e) => { e.preventDefault(); $('drop').classList.add('over'); });
    zone.addEventListener('dragleave', () => $('drop').classList.remove('over'));
    zone.addEventListener('drop', (e) => {
      e.preventDefault();
      $('drop').classList.remove('over');
      if (e.dataTransfer.files.length) loadFile(e.dataTransfer.files[0]);
    });
  }
  $('copy-out').addEventListener('click', onCopyOut);
  $('bring-back').addEventListener('click', onBringBack);
  $('restore-paste').addEventListener('click', onRestorePaste);
  $('copy').addEventListener('click', onCopy);
  $('export').addEventListener('click', onExport);
  $('preview').addEventListener('mouseup', () => setTimeout(onPreviewSelect, 0));
  $('preview').addEventListener('keyup', () => setTimeout(onPreviewSelect, 0));
  document.addEventListener('mousedown', (e) => { if (!$('tag-menu').contains(e.target) && !$('preview').contains(e.target)) $('tag-menu').hidden = true; });
  for (const b of document.querySelectorAll('#tag-menu [data-tag]')) b.addEventListener('click', () => onTag(b.dataset.tag));
  $('open-settings').addEventListener('click', openSettings);
  $('retention').addEventListener('change', onSettingsChange);
  $('community').addEventListener('change', onSettingsChange);
  $('delete-case').addEventListener('click', onDeleteCase);

  chrome.runtime.onMessage.addListener((msg, sender) => {
    if (msg && msg.ns === 'scrubber' && msg.event === 'conversation' && sender.tab && S.tab && sender.tab.id === S.tab.id) refreshTarget();
  });
  chrome.tabs.onActivated.addListener(() => refreshTarget());
  chrome.tabs.onUpdated.addListener((_id, info) => { if (info.status === 'complete' || info.url) refreshTarget(); });
  window.addEventListener('pagehide', () => { persistNow(); });

  const v = `v${chrome.runtime.getManifest().version}`;
  $('version').textContent = v;
  $('version2').textContent = v;
  applyLang();
  await refreshTarget();
  setInterval(refreshTarget, 2500);
}

boot();
