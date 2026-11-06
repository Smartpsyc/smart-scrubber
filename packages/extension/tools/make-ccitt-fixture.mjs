// Makes test/files/scan-ccitt-g4.pdf: a fax-style scan (1-bit, CCITT Group 4,
// the way many office scanners save pages), from a fictional sample letter.
// Needs libtiff's command-line tools (brew install libtiff). Run once; the PDF
// is committed so the tests don't need libtiff.
import { chromium } from 'playwright';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { SAMPLES, makeScan } from '../test/scans.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const tmp = mkdtempSync(join(tmpdir(), 'ccitt-'));
const browser = await chromium.launch();
const ctx = await browser.newContext();
const sample = SAMPLES.find((s) => s.id === 'letter');
const scan = await makeScan(ctx, sample, { dpi: 200, rotate: 0.8, noise: 30, threshold: 150 });
const page = await ctx.newPage();
const { w, h, bits } = await page.evaluate(async (b64) => {
  const img = new Image();
  img.src = `data:image/png;base64,${b64}`;
  await img.decode();
  const cv = Object.assign(document.createElement('canvas'), { width: img.width, height: img.height });
  const g = cv.getContext('2d');
  g.drawImage(img, 0, 0);
  const d = g.getImageData(0, 0, cv.width, cv.height).data;
  const row = Math.ceil(cv.width / 8);
  const out = new Uint8Array(row * cv.height);
  for (let y = 0; y < cv.height; y++) for (let x = 0; x < cv.width; x++) if (d[(y * cv.width + x) * 4] < 128) out[y * row + (x >> 3)] |= 0x80 >> (x & 7);
  let bin = '';
  for (let i = 0; i < out.length; i += 0x8000) bin += String.fromCharCode(...out.subarray(i, i + 0x8000));
  return { w: cv.width, h: cv.height, bits: btoa(bin) };
}, scan.buffer.toString('base64'));
await browser.close();
const pbm = Buffer.concat([Buffer.from(`P4\n${w} ${h}\n`), Buffer.from(bits, 'base64')]);
writeFileSync(join(tmp, 'page.pbm'), pbm);
execFileSync('ppm2tiff', ['-R', '200', join(tmp, 'page.pbm'), join(tmp, 'page.tif')]);
execFileSync('tiffcp', ['-c', 'g4', join(tmp, 'page.tif'), join(tmp, 'g4.tif')]);
execFileSync('tiff2pdf', ['-o', join(root, 'test', 'files', 'scan-ccitt-g4.pdf'), join(tmp, 'g4.tif')]);
rmSync(tmp, { recursive: true, force: true });
console.log('wrote test/files/scan-ccitt-g4.pdf');
