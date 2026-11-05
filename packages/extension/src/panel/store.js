// Encrypted case store.
// - One AES-GCM-256 key per browser profile, generated here, NON-EXTRACTABLE,
//   kept as a CryptoKey object in IndexedDB (extension origin). Its bytes can't
//   be read out, not even by this extension.
// - Each case is encrypted into chrome.storage.local under "case:<id>", with the
//   id as additional data, so a ciphertext can't be moved to another conversation.
// - Only updatedAt is stored in the clear (for expiry). Settings are plain.

const DB = 'scrubber';
const KEYS = 'keys';
const KEY_ID = 'case-key-v1';
const enc = new TextEncoder();
const dec = new TextDecoder();

function openDb() {
  return new Promise((resolve, reject) => {
    const r = indexedDB.open(DB, 1);
    r.onupgradeneeded = () => r.result.createObjectStore(KEYS);
    r.onsuccess = () => resolve(r.result);
    r.onerror = () => reject(r.error);
  });
}

function tx(db, mode, fn) {
  return new Promise((resolve, reject) => {
    const t = db.transaction(KEYS, mode);
    const req = fn(t.objectStore(KEYS));
    t.oncomplete = () => resolve(req.result);
    t.onerror = () => reject(t.error);
    t.onabort = () => reject(t.error);
  });
}

let keyPromise = null;
export function getKey() {
  keyPromise ||= (async () => {
    const db = await openDb();
    let key = await tx(db, 'readonly', (s) => s.get(KEY_ID));
    if (key) return key;
    const fresh = await crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
    try {
      await tx(db, 'readwrite', (s) => s.add(fresh, KEY_ID));
      return fresh;
    } catch {
      // Another panel created it first; use theirs.
      key = await tx(db, 'readonly', (s) => s.get(KEY_ID));
      if (!key) throw new Error('case key unavailable');
      return key;
    }
  })();
  keyPromise.catch(() => { keyPromise = null; });
  return keyPromise;
}

const b64 = (u8) => btoa(String.fromCharCode(...u8));
const unb64 = (s) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));
const slot = (id) => `case:${id}`;

export async function saveCase(id, data) {
  const key = await getKey();
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = new Uint8Array(await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv, additionalData: enc.encode(slot(id)) }, key, enc.encode(JSON.stringify(data)),
  ));
  // btoa over a spread is fine for case-sized payloads; chunk it to stay safe on long drafts.
  let s = '';
  for (let i = 0; i < ct.length; i += 0x8000) s += String.fromCharCode(...ct.subarray(i, i + 0x8000));
  await chrome.storage.local.set({ [slot(id)]: { v: 1, iv: b64(iv), ct: btoa(s), updatedAt: Date.now() } });
}

// → { status: 'ok', data } | { status: 'missing' } | { status: 'undecryptable' }
export async function loadCase(id) {
  const rec = (await chrome.storage.local.get(slot(id)))[slot(id)];
  if (!rec) return { status: 'missing' };
  try {
    const key = await getKey();
    const pt = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: unb64(rec.iv), additionalData: enc.encode(slot(id)) }, key, unb64(rec.ct),
    );
    return { status: 'ok', data: JSON.parse(dec.decode(pt)) };
  } catch {
    return { status: 'undecryptable' };
  }
}

export async function deleteCase(id) {
  await chrome.storage.local.remove(slot(id));
}

export async function moveCase(fromId, toId) {
  const r = await loadCase(fromId);
  if (r.status !== 'ok') return r;
  await saveCase(toId, r.data);
  await deleteCase(fromId);
  return r;
}

export async function sweep(retentionDays) {
  const all = await chrome.storage.local.get(null);
  const cutoff = Date.now() - retentionDays * 86400000;
  const old = Object.entries(all).filter(([k, v]) => k.startsWith('case:') && (!v || !(v.updatedAt > cutoff))).map(([k]) => k);
  if (old.length) await chrome.storage.local.remove(old);
  return old.length;
}

const SETTINGS = 'settings';
const DEFAULTS = { lang: null, retentionDays: 30, disclaimerAck: false };

export async function getSettings() {
  const s = (await chrome.storage.local.get(SETTINGS))[SETTINGS];
  return { ...DEFAULTS, ...(s || {}) };
}

export async function setSettings(patch) {
  const next = { ...(await getSettings()), ...patch };
  await chrome.storage.local.set({ [SETTINGS]: next });
  return next;
}
