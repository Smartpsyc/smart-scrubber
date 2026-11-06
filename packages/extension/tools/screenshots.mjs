// Panel screenshots for docs / the store listing: node tools/screenshots.mjs <out-dir> (after npm run build:test). SCHEME=dark for dark mode.
import { mkdtempSync } from 'node:fs'; import { tmpdir } from 'node:os'; import { join } from 'node:path';
import { chromium } from 'playwright'; import { startMock } from '../test/mock/server.mjs';
const out = process.argv[2];
const mock = await startMock();
const dist = new URL('../dist-test', import.meta.url).pathname;
const ctx = await chromium.launchPersistentContext(mkdtempSync(join(tmpdir(), 'shot-')), { channel: 'chromium', headless: true, locale: 'en-US', viewport: { width: 400, height: 1500 }, colorScheme: process.env.SCHEME === 'dark' ? 'dark' : 'light', args: [`--disable-extensions-except=${dist}`, `--load-extension=${dist}`] });
let [sw] = ctx.serviceWorkers(); if (!sw) sw = await ctx.waitForEvent('serviceworker');
const page = await ctx.newPage(); await page.goto(mock.origin + '/new');
const p = await ctx.newPage(); await p.goto(`chrome-extension://${new URL(sw.url()).host}/panel/panel.html`);
await p.locator('#status.ok').waitFor();
await p.screenshot({ path: join(out, 'panel-0-first-run.png'), fullPage: true });
await p.click('#disclaimer-ok');
const openFold = (id) => p.evaluate((x) => { for (let d = document.getElementById(x); d; d = d.parentElement) if (d.tagName === 'DETAILS') d.open = true; }, id);
// 1. The quick path: Auto, paste, everything else folded.
await p.fill('#compose', 'נועה כהן הגיעה עם אמה רחל מקריית אונו. ת.ז. 123456782, נולדה 12/03/2015.\nנועה סיפרה שהיא ישנה רע. המורה שירה לוי מבית הספר אלונים.');
await p.waitForTimeout(500);
await p.screenshot({ path: join(out, 'panel-1-quick.png'), fullPage: true });
// 2. Check and adjust, Hebrew: found automatically.
await openFold('suggestions-wrap');
await p.click('#lang'); await p.waitForTimeout(200);
await p.screenshot({ path: join(out, 'panel-2-check-he.png'), fullPage: true });
await openFold('add-box');
await p.screenshot({ path: join(out, 'panel-2b-people-he.png'), fullPage: true });
await p.click('#insert'); await p.waitForTimeout(300); await page.click('[data-testid="chat-input-send"]'); await page.locator('[data-testid="message-actions"]').waitFor({ state: 'attached' });
await p.click('#bring-back'); await p.locator('#restored-wrap').waitFor();
await p.screenshot({ path: join(out, 'panel-3-restored-he.png'), fullPage: true });
await ctx.close(); mock.server.close();
