// Renders src/icons/icon.svg to the PNG sizes Chrome needs: node tools/icons.mjs
// 128 keeps the store's 16px transparent margin; the toolbar sizes are cropped
// tighter so the shape reads at 16px.
import { chromium } from 'playwright';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const dir = join(dirname(fileURLToPath(import.meta.url)), '..', 'src', 'icons');
const svg = readFileSync(join(dir, 'icon.svg'), 'utf8');
const browser = await chromium.launch();
for (const size of [16, 32, 48, 128]) {
  const page = await browser.newPage({ viewport: { width: size, height: size } });
  // At 16px the pores and small bubbles are noise: keep the sponge, one bubble, the lock.
  const art = size === 16 ? svg.replace(/<[^>]*class="detail"[^>]*\/>/g, '') : svg;
  const box = size === 128 ? '0 0 128 128' : size === 48 ? '10 10 108 108' : '14 14 100 100';
  await page.setContent(`<html><body style="margin:0;background:transparent">${art.replace('viewBox="0 0 128 128"', `viewBox="${box}" width="${size}" height="${size}"`)}</body></html>`);
  await page.screenshot({ path: join(dir, `icon-${size}.png`), omitBackground: true, clip: { x: 0, y: 0, width: size, height: size } });
  await page.close();
}
await browser.close();
console.log('icons written');
