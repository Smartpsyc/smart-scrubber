// End-to-end: the unpacked test build in Chromium, driving the mock claude.ai page.
// Run with `npm test` (builds dist-test first).

import { test, before, after, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import { startMock } from './mock/server.mjs';
import { makeDocx, makePdfs } from './fixtures.mjs';
import { SAMPLES, CONDITIONS, makeScan, imagesToPdf } from './scans.mjs';

const dist = join(dirname(fileURLToPath(import.meta.url)), '..', 'dist-test');
let ctx, extId, mock, profile;
const pages = [];
// Every request any panel page makes (incl. its pdf.js worker), and any CSP refusal.
const offPanelRequests = [];
const cspRefusals = [];

before(async () => {
  mock = await startMock();
  profile = mkdtempSync(join(tmpdir(), 'scrubber-e2e-'));
  ctx = await chromium.launchPersistentContext(profile, {
    channel: 'chromium',
    headless: true,
    locale: 'en-US',
    args: [`--disable-extensions-except=${dist}`, `--load-extension=${dist}`],
  });
  let [sw] = ctx.serviceWorkers();
  if (!sw) sw = await ctx.waitForEvent('serviceworker');
  extId = new URL(sw.url()).host;
});

after(async () => {
  await ctx?.close();
  mock?.server.close();
  if (profile) rmSync(profile, { recursive: true, force: true });
});

afterEach(async () => {
  while (pages.length) await pages.pop().close().catch(() => {});
});

async function openMock(path = '/new') {
  const p = await ctx.newPage();
  pages.push(p);
  await p.goto(mock.origin + path);
  return p;
}

async function openPanel({ mode = 'manual' } = {}) {
  const p = await ctx.newPage();
  pages.push(p);
  p.on('request', (r) => { if (!/^(chrome-extension|data|blob):/.test(r.url())) offPanelRequests.push(r.url()); });
  p.on('console', (m) => { if (/Refused to|Content Security Policy/i.test(m.text())) cspRefusals.push(m.text()); });
  if (process.env.PANEL_LOG) { p.on('console', (m) => console.log('[panel]', m.text().slice(0, 300))); p.on('pageerror', (e) => console.log('[panel error]', e.message)); }
  await p.goto(`chrome-extension://${extId}/panel/panel.html`);
  const ok = p.locator('#disclaimer-ok');
  if (await ok.isVisible()) await ok.click();
  if (mode) { await p.locator('#mode-manual').waitFor({ state: 'attached' }); await p.waitForFunction(() => document.querySelector('.seg button[aria-checked="true"]')); await setMode(p, mode); }
  return p;
}

async function connected(panel) {
  await panel.locator('#status.ok').waitFor({ timeout: 8000 });
}

// Step 1 folds are exclusive (one open at a time): open the one a test needs.
async function fold(panel, id) {
  await panel.evaluate((x) => {
    for (let d = document.getElementById(x); d; d = d.parentElement) if (d.tagName === 'DETAILS') d.open = true;
  }, id);
}

async function fillCompose(panel, text) {
  await panel.fill('#compose', text);
}

async function openAdd(panel) {
  await fold(panel, 'add-box');
  await panel.evaluate(() => { for (const d of document.querySelectorAll('details.more')) d.open = true; });
}

// New cases start in Auto; most tests exercise the declared-names path.
async function setMode(panel, mode) {
  await fold(panel, 'people-box');
  await panel.click(`#mode-${mode}`);
}

async function restorePasted(panel, text) {
  await panel.evaluate(() => { for (const id of ['step3', 'paste-box']) document.getElementById(id).open = true; });
  await panel.fill('#paste', text);
  await panel.click('#restore-paste');
}

async function addPerson(panel, { first, firstOther = '', last = '', lastOther = '', gender = 'f', role = 'client' }) {
  await openAdd(panel);
  await panel.selectOption('#add-kind', 'person');
  await panel.fill('input[name=first]', first);
  await panel.fill('input[name=firstOther]', firstOther);
  await panel.fill('input[name=last]', last);
  await panel.fill('input[name=lastOther]', lastOther);
  await panel.selectOption('select[name=gender]', gender);
  await panel.selectOption('select[name=role]', role);
  await panel.click('#add-btn');
}

async function addPlace(panel, kind, name) {
  await openAdd(panel);
  await panel.selectOption('#add-kind', kind);
  await panel.fill('input[name=place]', name);
  await panel.click('#add-btn');
}

async function compose(panel, text) {
  await fillCompose(panel, text);
  await panel.waitForFunction(() => document.querySelector('#outgoing').textContent.trim().length > 0);
  await panel.waitForTimeout(350); // debounce
  return panel.locator('#outgoing').textContent();
}

// Panel puts the article into Claude's box; the clinician sends it from the page.
async function insertAndSend(panel, page) {
  await panel.click('#insert');
  await panel.locator('#send-msg', { hasText: "It's in Claude's message box" }).waitFor();
  await page.click('[data-testid="chat-input-send"]');
  await page.waitForURL(/\/chat\//);
}

const REAL = ['נועה', 'כהן', 'Noa', 'קריית אונו', '123456782', '052-1234567'];
const NOTE = 'נועה כהן (Noa) הגיעה עם אמה מקריית אונו. ת.ז. 123456782, טלפון 052-1234567.\n\nנועה סיפרה שהיא ישנה רע.';

test('manual: anonymize the article, work in Claude, restore the final version', async () => {
  const page = await openMock();
  const panel = await openPanel();
  await connected(panel);

  await addPerson(panel, { first: 'נועה', firstOther: 'Noa', last: 'כהן', lastOther: 'Cohen' });
  await panel.locator('#entities li[data-entity]').first().waitFor({ state: 'attached' });
  await addPlace(panel, 'town', 'קריית אונו');
  await panel.waitForFunction(() => document.querySelectorAll('#entities li[data-entity]').length === 2, null, { timeout: 3000 })
    .catch(async () => assert.fail(`entities: ${await panel.locator('#entities').textContent()} / error: ${await panel.locator('#add-error').textContent()}`));

  const outgoing = await compose(panel, NOTE);
  for (const r of REAL) assert.ok(!outgoing.includes(r), `outgoing still has ${r}`);
  assert.ok(await panel.locator('#preview mark.k-person').count() >= 3);

  // Never auto-sends: the text waits in Claude's box.
  await panel.click('#insert');
  await panel.locator('#send-msg', { hasText: "It's in Claude's message box" }).waitFor();
  assert.deepEqual(await page.evaluate(() => window.__sent), []);
  await page.click('[data-testid="chat-input-send"]');
  await page.waitForURL(/\/chat\//);

  const sent = await page.evaluate(() => window.__sent);
  assert.equal(sent.length, 1);
  for (const r of REAL) assert.ok(!sent[0].includes(r), `page received ${r}`);
  assert.equal(sent[0].replace(/\s+/g, ''), outgoing.replace(/\s+/g, ''));
  const conv = new URL(page.url()).pathname.split('/')[2];
  assert.match(conv, /^[0-9a-f-]{36}$/);

  // Encrypted at rest, moved to the conversation once Claude gave it an id, draft gone.
  await panel.waitForFunction((c) => chrome.storage.local.get(`case:${c}`).then((r) => !!r[`case:${c}`]), conv);
  const all = await panel.evaluate(() => chrome.storage.local.get(null));
  assert.ok(all[`case:${conv}`], 'case saved under the conversation id');
  assert.ok(!Object.keys(all).some((k) => k.startsWith('case:draft-')), 'draft removed');
  const raw = JSON.stringify(all);
  for (const r of ['נועה', 'Noa', 'Cohen', 'קריית']) assert.ok(!raw.includes(r), `storage leaks ${r}`);

  // Bring back: restored, markdown kept, screen-reader heading skipped.
  await page.locator('[data-testid="message-actions"]').waitFor({ state: 'attached' });
  await panel.click('#bring-back');
  await panel.locator('#restored-wrap').waitFor();
  const restored = await panel.locator('#restored').textContent();
  assert.ok(restored.startsWith('## Summary'), restored);
  assert.ok(restored.includes('**נועה** is the key point'), restored);
  assert.ok(restored.includes('- Second point'));
  assert.ok(restored.includes('> נועה כהן (Noa)'));
  assert.ok(!restored.includes('Claude responded'));

  // Paste box: exact round trip.
  await restorePasted(panel, sent[0]);
  await panel.waitForFunction((t) => document.querySelector('#restored').textContent === t, NOTE);

  // The claude.ai page never received a real identifier at any point.
  const pageText = await page.evaluate(() => document.body.innerText);
  for (const r of REAL) assert.ok(!pageText.includes(r), `page shows ${r}`);

  // A new panel on the same conversation reopens the same case.
  const panel2 = await openPanel();
  await connected(panel2);
  await panel2.locator('#entities li[data-entity]').first().waitFor({ state: 'attached' });
  assert.equal(await panel2.locator('#entities li[data-entity]').count(), 2);
  await restorePasted(panel2, sent[0]);
  await panel2.waitForFunction((t) => document.querySelector('#restored').textContent === t, NOTE);
});

test("adds the article after the clinician's own instructions in Claude's box", async () => {
  const page = await openMock();
  await page.click('[data-testid="chat-input"]');
  await page.keyboard.type('Please shorten this article:');
  const panel = await openPanel();
  await connected(panel);
  await addPerson(panel, { first: 'דנה' });
  await compose(panel, 'דנה הגיעה.');
  await insertAndSend(panel, page);
  const [sent] = await page.evaluate(() => window.__sent);
  assert.ok(sent.startsWith('Please shorten this article:'), sent);
  assert.ok(!sent.includes('דנה'), sent);
  assert.match(sent, /הגיעה\.$/);
});

test('copy anonymized commits the case without touching Claude', async () => {
  const page = await openMock();
  const panel = await openPanel();
  await connected(panel);
  await addPerson(panel, { first: 'מיכל' });
  const out = await compose(panel, 'מיכל הגיעה.');
  await panel.click('#copy-out');
  await panel.locator('#send-msg', { hasText: 'copied' }).waitFor();
  assert.equal(await page.evaluate(() => document.querySelector('[data-testid="chat-input"]').innerText.trim()), '');
  await restorePasted(panel, out);
  await panel.waitForFunction(() => document.querySelector('#restored').textContent === 'מיכל הגיעה.');
});

test("fails closed when Claude's page structure is unknown", async () => {
  await openMock('/new?broken=1');
  const panel = await openPanel();
  await panel.locator('#status.bad').waitFor();
  assert.match(await panel.locator('#status').textContent(), /paused/);
  await addPerson(panel, { first: 'דנה' });
  await fillCompose(panel, 'דנה הגיעה.');
  await panel.waitForTimeout(400);
  assert.equal(await panel.locator('#insert').isDisabled(), true);
  assert.equal(await panel.locator('#copy-out').isDisabled(), false, 'copy needs no page');
});

test('bring back waits for Claude to finish writing', async () => {
  const page = await openMock('/new?slow=1');
  const panel = await openPanel();
  await connected(panel);
  await addPerson(panel, { first: 'אורי', gender: 'm' });
  await compose(panel, 'אורי הגיע.');
  await insertAndSend(panel, page);
  await page.waitForFunction(() => typeof window.__finish === 'function');
  await panel.click('#bring-back');
  await panel.locator('#restore-msg.err', { hasText: 'still writing' }).waitFor();
  await page.evaluate(() => window.__finish());
  await panel.click('#bring-back');
  await panel.locator('#restored-wrap').waitFor();
  const got = await panel.locator('#restored').textContent();
  assert.ok(got.includes('**אורי** is the key point'), `${got}\nsent: ${await page.evaluate(() => window.__sent[0])}`);
});

test('auto mode: suggestions are scrubbed unless unticked, and join the case on send', async () => {
  const page = await openMock();
  const panel = await openPanel();
  await connected(panel);
  await fold(panel, 'people-box');
  await panel.click('#mode-auto');
  const text = 'נועם הגיע עם אמו רחל לוי מחיפה. המורה גב\' שירה אמרה שהוא מתקשה.';
  let out = await compose(panel, text);
  await fold(panel, 'suggestions-wrap');
  await panel.locator('#suggestions li[data-suggestion]').first().waitFor();
  for (const r of ['רחל', 'לוי', 'חיפה', 'שירה']) assert.ok(!out.includes(r), `auto missed ${r}: ${out}`);

  // Untick the teacher → her name stays as is.
  const chip = panel.locator('#suggestions li[data-suggestion]', { hasText: 'שירה' });
  await chip.locator('input[type=checkbox]').uncheck();
  await panel.waitForFunction(() => document.querySelector('#outgoing').textContent.includes('שירה'));
  out = await panel.locator('#outgoing').textContent();
  assert.ok(!out.includes('רחל'));

  await chip.locator('input[type=checkbox]').check();
  await panel.waitForFunction(() => !document.querySelector('#outgoing').textContent.includes('שירה'));
  await insertAndSend(panel, page);
  const sent = await page.evaluate(() => window.__sent[0]);
  for (const r of ['רחל', 'לוי', 'חיפה', 'שירה']) assert.ok(!sent.includes(r), `sent ${r}`);
  const names = await panel.locator('#entities').textContent();
  for (const r of ['רחל', 'שירה', 'חיפה']) assert.ok(names.includes(r), `case lacks ${r}: ${names}`);
});

test('tag-a-word adds a selected word to the case', async () => {
  await openMock();
  const panel = await openPanel();
  await connected(panel);
  let out = await compose(panel, 'דני הגיע עם יואב.');
  assert.ok(out.includes('דני'));
  await fold(panel, 'preview-box');
  await panel.evaluate(() => {
    const node = document.querySelector('#preview').firstChild;
    const r = document.createRange();
    r.setStart(node, 0);
    r.setEnd(node, 3);
    const s = getSelection();
    s.removeAllRanges();
    s.addRange(r);
    document.querySelector('#preview').dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));
  });
  await panel.locator('#tag-menu:not([hidden])').waitFor();
  await panel.click('#tag-menu [data-tag="m"]');
  await panel.waitForFunction(() => !document.querySelector('#outgoing').textContent.includes('דני'));
  out = await panel.locator('#outgoing').textContent();
  assert.ok(out.includes('יואב'), 'untagged name untouched in manual mode');
});

test('Hebrew UI is right-to-left', async () => {
  await openMock();
  const panel = await openPanel();
  await connected(panel);
  await panel.click('#lang');
  assert.equal(await panel.evaluate(() => document.documentElement.dir), 'rtl');
  assert.equal(await panel.locator('#status').textContent(), 'מחובר ל-Claude');
  assert.match(await panel.locator('#version').textContent(), /^v\d+\.\d+\.\d+$/);
  await panel.click('#lang');
});

test('a long article becomes a Claude attachment: counted as done, never sent, never duplicated', async () => {
  const page = await openMock();
  const panel = await openPanel();
  await connected(panel);
  await addPerson(panel, { first: 'נועה' });
  const article = Array.from({ length: 120 }, (_, i) => `${i + 1}. נועה סיפרה על השבוע שלה בבית הספר ובבית.`).join('\n\n');
  await compose(panel, article);
  await panel.click('#insert');
  await panel.locator('#send-msg', { hasText: 'as an attachment' }).waitFor();
  assert.deepEqual(await page.evaluate(() => window.__sent), []);
  assert.equal(await page.locator('[data-testid="file-thumbnail"]').count(), 1);
  assert.equal(await page.evaluate(() => document.querySelector('[data-testid="chat-input"]').innerText.trim()), '');
  assert.equal(await panel.evaluate(() => document.getElementById('step3').open), true, 'restore step opens');
  await page.click('[data-testid="chat-input-send"]');
  const [sent] = await page.evaluate(() => window.__sent);
  assert.ok(!sent.includes('נועה') && sent.includes('120.'), 'the attachment carried the anonymized article');
});

async function loadFileInto(panel, name, mimeType, buffer) {
  await panel.setInputFiles('#file', { name, mimeType, buffer });
  await panel.locator('#file-msg').filter({ hasText: /Loaded|Read from a scan|Couldn't|big|Use a/ }).waitFor({ timeout: 90_000 });
  return panel.locator('#file-msg').textContent();
}

test('files are read locally: Word, a Hebrew PDF, plain text', async () => {
  await openMock();
  const panel = await openPanel();
  await connected(panel);
  await addPerson(panel, { first: 'נועה', last: 'כהן' });
  await addPlace(panel, 'town', 'קריית אונו');

  let msg = await loadFileInto(panel, 'Noa report.docx', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', makeDocx());
  assert.match(msg, /Loaded on this computer: Noa report\.docx/);
  let article = await panel.inputValue('#compose');
  assert.ok(article.includes('**נועה כהן** הגיעה עם אמה מקריית אונו.'), article);
  assert.ok(article.includes('| שם | נועה כהן |'), 'table kept as Markdown');
  let out = await panel.locator('#outgoing').textContent();
  await panel.waitForFunction(() => document.querySelector('#outgoing').textContent.includes('|'));
  out = await panel.locator('#outgoing').textContent();
  for (const r of ['נועה', 'כהן', 'קריית אונו', '123456782']) assert.ok(!out.includes(r), `docx outgoing has ${r}`);

  await fillCompose(panel, '');
  const { text: pdf, scan } = await makePdfs(ctx);
  msg = await loadFileInto(panel, 'report.pdf', 'application/pdf', pdf);
  assert.match(msg, /Loaded/);
  article = await panel.inputValue('#compose');
  assert.ok(article.includes('נועה כהן הגיעה עם אמה מקריית אונו.'), `Hebrew PDF in logical order: ${article}`);
  assert.ok(article.includes('ספטמבר 2023'), article);
  await panel.waitForFunction(() => document.querySelector('#outgoing').textContent.trim().length > 0);
  await panel.waitForTimeout(350);
  out = await panel.locator('#outgoing').textContent();
  for (const r of ['נועה', 'כהן', 'קריית אונו', '123456782']) assert.ok(!out.includes(r), `pdf outgoing has ${r}`);

  await fillCompose(panel, '');
  msg = await loadFileInto(panel, 'scan.pdf', 'application/pdf', scan);
  assert.match(msg, /Read from a scan on this computer: scan\.pdf\. Scans can be misread/);
  const scanText = await panel.inputValue('#compose');
  assert.match(scanText, /scanned page: \S+ text layer/i, `an English scan is read too: ${scanText}`);
  await fillCompose(panel, '');

  await fillCompose(panel, 'קודם.');
  msg = await loadFileInto(panel, 'note.txt', 'text/plain', Buffer.from('נועה הגיעה.\r\n'));
  assert.equal(await panel.inputValue('#compose'), 'קודם.\n\nנועה הגיעה.', 'appended, line endings tidied');

  msg = await loadFileInto(panel, 'x.xlsx', 'application/octet-stream', Buffer.from('x'));
  assert.match(msg, /Use a \.docx/);
});

test('scans and photos are read on this computer (OCR), then scrubbed', async () => {
  await openMock();
  const panel = await openPanel();
  await connected(panel);
  await addPerson(panel, { first: 'יעל', last: 'ברקוביץ' });
  await addPerson(panel, { first: 'עומר', last: 'חדד' });

  // A two-page scanner PDF: a flatbed scan and a tilted phone photo, no text layer.
  const [report, letter] = SAMPLES;
  const pages = [await makeScan(ctx, report, CONDITIONS.scan200), await makeScan(ctx, letter, CONDITIONS.photo)];
  const pdf = await imagesToPdf(ctx, pages);
  const seen = [];
  const watch = setInterval(async () => { try { seen.push(await panel.locator('#file-msg').textContent()); } catch { /* closing */ } }, 150);
  const msg = await loadFileInto(panel, 'scanned report.pdf', 'application/pdf', pdf);
  clearInterval(watch);
  assert.match(msg, /Read from a scan on this computer: scanned report\.pdf/);
  assert.equal(await panel.evaluate(() => document.getElementById('file-msg').classList.contains('warn')), true);
  assert.ok(seen.some((m) => /page 2 of 2/.test(m)), `progress shown: ${[...new Set(seen)].join(' | ')}`);
  const article = await panel.inputValue('#compose');
  for (const id of [...report.ids, ...letter.ids]) assert.ok(article.includes(id), `OCR kept ${id}:\n${article}`);
  assert.ok(article.indexOf('יעל ברקוביץ') < article.indexOf('עומר חדד'), 'pages in order');
  await panel.waitForFunction(() => document.querySelector('#outgoing').textContent.includes('ת.ז.'));
  await panel.waitForTimeout(350);
  const out = await panel.locator('#outgoing').textContent();
  for (const r of ['יעל', 'ברקוביץ', 'עומר', 'חדד', '204518732', '318472651']) assert.ok(!out.includes(r), `outgoing has ${r}`);

  // A phone photo on its own (JPEG).
  await fillCompose(panel, '');
  const note = SAMPLES[2];
  const photo = await makeScan(ctx, note, CONDITIONS.photo);
  assert.match(await loadFileInto(panel, 'IMG_2041.jpg', 'image/jpeg', photo.buffer), /Read from a scan/);
  const text = await panel.inputValue('#compose');
  for (const id of note.ids) assert.ok(text.includes(id), `photo OCR kept ${id}:\n${text}`);

  // A fax-style office scan: 1-bit CCITT Group 4 (decoded by pdf.js's bundled JS decoder).
  await fillCompose(panel, '');
  const g4 = readFileSync(join(dirname(fileURLToPath(import.meta.url)), 'files', 'scan-ccitt-g4.pdf'));
  assert.match(await loadFileInto(panel, 'fax.pdf', 'application/pdf', g4), /Read from a scan/);
  const fax = await panel.inputValue('#compose');
  for (const id of letter.ids) assert.ok(fax.includes(id), `CCITT scan OCR kept ${id}:\n${fax}`);
});

test('the panel never touched the network (pdf.js, mammoth and Tesseract included)', () => {
  assert.deepEqual(offPanelRequests, []);
  assert.deepEqual(cspRefusals, []);
});

test('quick path: a new case starts in Auto, paste and click; details wait under one fold', async () => {
  const page = await openMock();
  const panel = await openPanel({ mode: null });
  await connected(panel);
  assert.equal(await panel.locator('#mode-auto').getAttribute('aria-checked'), 'true', 'Auto by default');
  assert.equal(await panel.evaluate(() => document.getElementById('more-box').open), false, 'details folded');
  await compose(panel, 'נועה כהן הגיעה עם אמה רחל מחיפה.');
  assert.equal(await panel.locator('#article-count').textContent(), '7 words');
  await panel.waitForFunction(() => /found · \d+ to replace/.test(document.getElementById('more-count').textContent));
  await insertAndSend(panel, page);
  const sent = await page.evaluate(() => window.__sent[0]);
  for (const r of ['נועה', 'כהן', 'רחל', 'חיפה']) assert.ok(!sent.includes(r), `sent ${r}: ${sent}`);

  // Inside "Check and adjust" one part is open at a time.
  const open = () => panel.evaluate(() => [...document.querySelectorAll('details[name="s1"]')].filter((d) => d.open).map((d) => d.id));
  await fold(panel, 'people-box');
  assert.match(await panel.locator('#people-count').textContent(), /· Auto/);
  await panel.click('#preview-box > summary');
  assert.deepEqual(await open(), ['preview-box']);
});

test('found schools: whole name on the chip, unticked one at a time', async () => {
  await openMock();
  const panel = await openPanel({ mode: null });
  await connected(panel);
  await compose(panel, 'לומדת בבית הספר אלונים, אחיה בבית הספר ויצמן.');
  await fold(panel, 'suggestions-wrap');
  const alonim = panel.locator('#suggestions li[data-suggestion]', { hasText: 'בית הספר אלונים' });
  await alonim.waitFor();
  // Unticking one school leaves the other ticked.
  await alonim.locator('input[type=checkbox]').uncheck();
  assert.equal(await panel.locator('#suggestions li[data-suggestion]', { hasText: 'בית הספר ויצמן' }).locator('input').isChecked(), true);
});
