// End-to-end: the unpacked test build in Chromium, driving the mock claude.ai page.
// Run with `npm test` (builds dist-test first).

import { test, before, after, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import { startMock } from './mock/server.mjs';
import { makeDocx, makePdfs } from './fixtures.mjs';

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

async function openPanel() {
  const p = await ctx.newPage();
  pages.push(p);
  p.on('request', (r) => { if (!/^(chrome-extension|data|blob):/.test(r.url())) offPanelRequests.push(r.url()); });
  p.on('console', (m) => { if (/Refused to|Content Security Policy/i.test(m.text())) cspRefusals.push(m.text()); });
  await p.goto(`chrome-extension://${extId}/panel/panel.html`);
  const ok = p.locator('#disclaimer-ok');
  if (await ok.isVisible()) await ok.click();
  return p;
}

async function connected(panel) {
  await panel.locator('#status.ok').waitFor({ timeout: 8000 });
}

// Step 1 folds are exclusive (one open at a time): open the one a test needs.
async function fold(panel, id) {
  await panel.evaluate((x) => { document.getElementById(x).open = true; }, id);
}

async function fillCompose(panel, text) {
  await fold(panel, 'article-box');
  await panel.fill('#compose', text);
}

async function openAdd(panel) {
  await panel.evaluate(() => {
    for (const id of ['people-box', 'add-box']) document.getElementById(id).open = true;
    for (const d of document.querySelectorAll('details.more')) d.open = true;
  });
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
  await panel.locator('#file-msg').filter({ hasText: /Loaded|scan|read|big|Use a/ }).waitFor();
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

  msg = await loadFileInto(panel, 'scan.pdf', 'application/pdf', scan);
  assert.match(msg, /scan with no text/);

  await fillCompose(panel, 'קודם.');
  msg = await loadFileInto(panel, 'note.txt', 'text/plain', Buffer.from('נועה הגיעה.\r\n'));
  assert.equal(await panel.inputValue('#compose'), 'קודם.\n\nנועה הגיעה.', 'appended, line endings tidied');

  msg = await loadFileInto(panel, 'x.xlsx', 'application/octet-stream', Buffer.from('x'));
  assert.match(msg, /Use a \.docx/);
});

test('the panel never touched the network (pdf.js and mammoth included)', () => {
  assert.deepEqual(offPanelRequests, []);
  assert.deepEqual(cspRefusals, []);
});

test('step 1 folds: one open at a time, each header says where things stand', async () => {
  await openMock();
  const panel = await openPanel();
  await connected(panel);
  const open = () => panel.evaluate(() => [...document.querySelectorAll('details[name="s1"]')].filter((d) => d.open).map((d) => d.id));
  assert.deepEqual(await open(), ['article-box'], 'the article is open first');
  assert.match(await panel.locator('#people-count').textContent(), /none yet · Manual/);
  await addPerson(panel, { first: 'נועה', last: 'כהן' });
  assert.deepEqual(await open(), ['people-box'], 'opening one closes the others');
  assert.match(await panel.locator('#people-count').textContent(), /\(1\) · Manual/);
  await compose(panel, 'נועה כהן הגיעה היום.');
  assert.deepEqual(await open(), ['article-box']);
  assert.equal(await panel.locator('#article-count').textContent(), '4 words');
  assert.equal(await panel.locator('#preview-count').textContent(), '2 to replace');
  await panel.click('#preview-box > summary');
  assert.deepEqual(await open(), ['preview-box']);
  assert.equal(await panel.locator('#insert').isDisabled(), false, 'the buttons stay outside the folds');
});
