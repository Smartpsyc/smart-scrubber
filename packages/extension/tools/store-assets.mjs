// Chrome Web Store images: node tools/store-assets.mjs <panel-shots-dir>
// (make the shots first: npm run build:test && node tools/screenshots.mjs <dir>).
// Writes store/screenshot-*.png (1280×800) and store/promo-small.png (440×280).
import { chromium } from 'playwright';
import { readFileSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const shots = process.argv[2];
const outDir = join(root, 'store');
mkdirSync(outDir, { recursive: true });
const b64 = (f) => readFileSync(f).toString('base64');
const icon = readFileSync(join(root, 'src', 'icons', 'icon.svg'), 'utf8');

const SLIDES = [
  { file: 'panel-1-quick.png', out: 'screenshot-1-paste.png', rtl: false,
    title: 'Paste. Click. Claude only sees stand-ins.',
    lines: ['Names, IDs, phones, dates, towns and schools are swapped before anything reaches claude.ai.', 'Word, PDF, scans and photos are read on your computer.'] },
  { file: 'panel-2-check-he.png', out: 'screenshot-2-check.png', rtl: true,
    title: 'עברית ואנגלית, עם בדיקה לפני שליחה',
    lines: ['מה שנמצא אוטומטית מופיע לבדיקה: אפשר לבטל, להוסיף ולראות בדיוק מה Claude יקבל.', 'שמות חלופיים באותו מגדר, כך שהטקסט נשאר תקין.'] },
  { file: 'panel-3-restored-he.png', out: 'screenshot-3-restore.png', rtl: true,
    title: 'החזרת השמות האמיתיים בלחיצה',
    lines: ['כש-Claude מסיים, השמות האמיתיים חוזרים לגרסה הסופית, רק במחשב שלכם.', 'המפתח מוצפן ונשמר בדפדפן. שום דבר לא נשלח לשרת.'] },
];

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
for (const s of SLIDES) {
  await page.setContent(`<html dir="${s.rtl ? 'rtl' : 'ltr'}"><body style="margin:0;width:1280px;height:800px;background:#f5f4ed;font-family:-apple-system,'Segoe UI',Arial,sans-serif;display:flex;align-items:center;gap:56px;padding:0 72px;box-sizing:border-box;overflow:hidden">
    <div style="flex:1;color:#141413">
      <div style="display:flex;align-items:center;gap:10px;margin-bottom:28px">${icon.replace('<svg ', '<svg width="44" height="44" ')}<span style="font:500 24px Georgia,serif">Smart Scrubber</span></div>
      <h1 style="font:500 44px/1.15 Georgia,'Times New Roman',serif;margin:0 0 24px;letter-spacing:-.01em">${s.title}</h1>
      ${s.lines.map((l) => `<p style="font-size:21px;line-height:1.5;color:#55544f;margin:0 0 12px">${l}</p>`).join('')}
      <p style="font-size:15px;color:#6f6e69;margin-top:36px">${s.rtl ? 'מבית צוות SmartPsyc · smartpsyc.com' : 'by the SmartPsyc team · smartpsyc.com'}</p>
    </div>
    <div style="flex:none;width:420px;height:800px;overflow:hidden;padding-top:40px;box-sizing:border-box">
      <img src="data:image/png;base64,${b64(join(shots, s.file))}" style="width:400px;display:block;border-radius:14px;box-shadow:0 12px 40px rgba(20,20,19,.16);border:1px solid #e6e3d9">
    </div></body></html>`);
  await page.screenshot({ path: join(outDir, s.out) });
}
await page.setViewportSize({ width: 440, height: 280 });
await page.setContent(`<html><body style="margin:0;width:440px;height:280px;background:#c96442;display:flex;align-items:center;justify-content:center;gap:18px;font-family:Georgia,serif;color:#faf9f5;box-sizing:border-box">
  ${icon.replace('<svg ', '<svg width="120" height="120" ').replace('fill="#c96442"/>', 'fill="#b4532f"/>')}
  <div><div style="font-size:34px;font-weight:500">Smart Scrubber</div><div style="font:17px/1.4 -apple-system,Arial,sans-serif;opacity:.92;margin-top:6px">Anonymize for Claude.<br>Restore when done.</div></div></body></html>`);
await page.screenshot({ path: join(outDir, 'promo-small.png') });
await browser.close();
console.log(`store images in ${outDir}`);
