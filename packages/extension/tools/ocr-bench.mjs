// OCR benchmark: which Tesseract language data reads our (fake) Hebrew scans best.
//
//   node tools/ocr-bench.mjs [extraDataDir...] [--save dir]
//
// Each extra dir holds raw heb/eng (or Hebrew) .traineddata files, e.g. downloaded
// from github.com/tesseract-ocr/tessdata_best — used here only, never shipped.
// Scores: CER (character error rate, lower is better), how many identifiers came
// through exactly (they must, or the scrubber can't find them), seconds per page.

import { chromium } from 'playwright';
import { createWorker } from 'tesseract.js';
import { mkdirSync, writeFileSync, existsSync } from 'node:fs';
import { join, dirname, basename } from 'node:path';
import { fileURLToPath } from 'node:url';
import { SAMPLES, CONDITIONS, makeScan } from '../test/scans.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const saveAt = args.includes('--save') ? args[args.indexOf('--save') + 1] : null;
const extra = args.filter((a, i) => !a.startsWith('--') && args[i - 1] !== '--save');

const data = (lang, v) => join(root, 'node_modules', '@tesseract.js-data', lang, v);
const VARIANTS = [
  { name: 'tjs best_int heb+eng', langs: 'heb+eng', langPath: data('heb', '4.0.0_best_int'), gzip: true, split: { eng: data('eng', '4.0.0_best_int') } },
  { name: 'tjs best_int eng', langs: 'eng', langPath: data('eng', '4.0.0_best_int'), gzip: true },
];
for (const dir of extra) {
  const lang = existsSync(join(dir, 'Hebrew.traineddata')) ? 'Hebrew' : 'heb';
  VARIANTS.push({ name: `${basename(dir)} ${lang}+eng`, langs: `${lang}+eng`, langPath: dir, gzip: false, eng: existsSync(join(dir, 'eng.traineddata')) ? null : 'missing' });
}

const norm = (s) => s.replace(/[״“”]/g, '"').replace(/[׳‘’]/g, "'").replace(/[‐‑–—]/g, '-').replace(/\s+/g, ' ').trim();
function lev(a, b) {
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const cur = [i];
    for (let j = 1; j <= b.length; j++) cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    prev = cur;
  }
  return prev[b.length];
}

// Languages may live in different folders, some gzipped: gather each variant's
// files, unzipped, into one temp folder. (Passing {code, data} objects to
// createWorker is broken in tesseract.js 7: initialize() uses data as the name.)
import { readFileSync, rmSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { tmpdir } from 'node:os';
const tmp = join(tmpdir(), 'ocr-bench-langs');
function langDir(v, k) {
  const dir = join(tmp, String(k));
  mkdirSync(dir, { recursive: true });
  for (const code of v.langs.split('+')) {
    const from = (v.split && v.split[code]) || v.langPath;
    let file = join(from, `${code}.traineddata${v.gzip ? '.gz' : ''}`);
    if (!existsSync(file)) file = join(root, 'node_modules', '@tesseract.js-data', code, '4.0.0_best_int', `${code}.traineddata.gz`);
    const buf = readFileSync(file);
    writeFileSync(join(dir, `${code}.traineddata`), buf[0] === 0x1f && buf[1] === 0x8b ? gunzipSync(buf) : buf);
  }
  return dir;
}

const browser = await chromium.launch();
const ctx = await browser.newContext();
const scans = [];
for (const s of SAMPLES) {
  for (const [cname, c] of Object.entries(CONDITIONS)) {
    const im = await makeScan(ctx, s, c);
    scans.push({ s, cname, im });
    if (saveAt) { mkdirSync(saveAt, { recursive: true }); writeFileSync(join(saveAt, `${s.id}-${cname}.${im.mime === 'image/jpeg' ? 'jpg' : 'png'}`), im.buffer); }
  }
}
// The same scans after the panel's clean-up step (src/panel/ocr-prep.js), run in Chromium.
const prepSrc = readFileSync(join(root, 'src', 'panel', 'ocr-prep.js'), 'utf8').replace(/^export /gm, '');
const prepPage = await ctx.newPage();
await prepPage.addScriptTag({ content: prepSrc });
for (const sc of [...scans]) {
  const b64 = await prepPage.evaluate(async ({ b64, mime }) => {
    const img = new Image();
    img.src = `data:${mime};base64,${b64}`;
    await img.decode();
    const cv = Object.assign(document.createElement('canvas'), { width: img.width, height: img.height });
    cv.getContext('2d').drawImage(img, 0, 0);
    return prepareForOcr(cv).toDataURL('image/png').split(',')[1];
  }, { b64: sc.im.buffer.toString('base64'), mime: sc.im.mime });
  const im = { buffer: Buffer.from(b64, 'base64'), mime: 'image/png' };
  scans.push({ s: sc.s, cname: `${sc.cname}+prep`, im });
  if (saveAt) writeFileSync(join(saveAt, `${sc.s.id}-${sc.cname}+prep.png`), im.buffer);
}
await browser.close();

rmSync(tmp, { recursive: true, force: true });
const rows = [];
for (const v of VARIANTS) {
  try { await runVariant(v); } catch (e) { console.log(`${v.name}: failed (${String(e.message || e).slice(0, 120)})`); }
}
async function runVariant(v) {
  const worker = await createWorker(v.langs, 1, { langPath: langDir(v, VARIANTS.indexOf(v)), gzip: false, cacheMethod: 'none' });
  const per = {};
  for (const { s, cname, im } of scans) {
    const t0 = performance.now();
    const { data: { text } } = await worker.recognize(im.buffer);
    const secs = (performance.now() - t0) / 1000;
    const got = norm(text);
    const gt = norm(s.text);
    const cer = lev(gt, got) / gt.length;
    const hit = s.ids.filter((id) => got.includes(norm(id))).length;
    const key = `${cname}${s.dir === 'ltr' ? ' EN' : ''}`;
    const p = (per[key] ||= { cer: 0, hit: 0, ids: 0, secs: 0, n: 0, miss: [] });
    p.cer += cer; p.hit += hit; p.ids += s.ids.length; p.secs += secs; p.n++;
    p.miss.push(...s.ids.filter((id) => !got.includes(norm(id))));
    if (saveAt) writeFileSync(join(saveAt, `${s.id}-${cname}.${v.name.replace(/\W+/g, '_')}.txt`), text);
  }
  await worker.terminate();
  for (const [cname, p] of Object.entries(per)) rows.push({ variant: v.name, cond: cname, cer: p.cer / p.n, ids: `${p.hit}/${p.ids}`, secs: p.secs / p.n, miss: p.miss.join(', ') });
}
// Float (tessdata_best) models need SSE code the wasm build lacks: int models only.

console.log('variant'.padEnd(28), 'condition'.padEnd(10), 'CER'.padStart(6), 'ids'.padStart(7), 's/page'.padStart(7), ' missed');
for (const r of rows) console.log(r.variant.padEnd(28), r.cond.padEnd(10), (r.cer * 100).toFixed(1).padStart(5) + '%', r.ids.padStart(7), r.secs.toFixed(1).padStart(7), ' ' + r.miss);
