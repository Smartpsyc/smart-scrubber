// Fake scans for OCR tests and the OCR benchmark (tools/ocr-bench.mjs).
// Fictional Hebrew clinical texts, printed by Chromium, then made to look like a
// scanner, fax or phone produced them. Every name, number and place is made up.

export const SAMPLES = [
  {
    id: 'report',
    font: 'Arial',
    text: `סיכום הערכה פסיכולוגית
שם: יעל ברקוביץ, ת.ז. 204518732, תאריך לידה: 14/05/2016.
כתובת: רחוב הרימון 12, רמת השרון. טלפון: 052-7184432.
יעל, בת 8, הופנתה להערכה על ידי היועצת בבית הספר "אלונים" בעקבות קשיי קשב וריכוז. לדברי האם, מיכל ברקוביץ, יעל מתקשה להירדם ונוטה להתפרצויות כעס בערב. האב, אלון, עובד במשמרות.
במבחן WISC-V התקבל ציון כללי של 104, ובשאלון Conners 3 דווח על ציונים גבוהים בתחום הקשב. נמצאת במעקב ד"ר רינה שפירא מקופת חולים מכבי.`,
    ids: ['יעל', 'ברקוביץ', '204518732', '14/05/2016', 'רמת השרון', '052-7184432', 'אלונים', 'מיכל', 'אלון', 'רינה', 'שפירא'],
  },
  {
    id: 'letter',
    font: 'Times New Roman',
    text: `מכתב הפניה
לכבוד: ד"ר אבי לנדאו, מכון התפתחות הילד, באר שבע
הנדון: עומר חדד, ת.ז. 318472651
עומר, בן 11, תלמיד כיתה ה' בבית הספר "הרא"ה" באופקים, הגיע עם אביו, דוד חדד.
- מיום 3.2.2024 חלה ירידה בהישגים.
- בבדיקת ADOS-2 לא נמצאו סימנים מובהקים.
- מומלץ המשך טיפול רגשי אחת לשבוע.
בברכה, נועה פרידמן, פסיכולוגית חינוכית`,
    ids: ['אבי', 'לנדאו', 'באר שבע', 'עומר', 'חדד', '318472651', 'הרא"ה', 'באופקים', 'דוד', 'נועה', 'פרידמן', '3.2.2024'],
  },
  {
    id: 'note',
    font: 'Arial',
    text: `תיעוד מפגש 7.11.2024
נוכחים: שירה אסרס (המטופלת), אמה ורד אסרס ואחיה הצעיר יונתן.
שירה סיפרה שהיא עברה מקריית גת לנתיבות בקיץ האחרון. בבית הספר החדש היא מרגישה בודדה. המחנכת, גב' סבטלנה קוגן, דיווחה על הסתגרות בהפסקות.
ציוני BDI-II: 21 (דיכאון בינוני). המלצה: פגישה עם הפסיכיאטרית ד"ר אולגה מירונוב.
איש קשר: vered.asres@example.com`,
    ids: ['7.11.2024', 'שירה', 'אסרס', 'ורד', 'יונתן', 'מקריית גת', 'לנתיבות', 'סבטלנה', 'קוגן', 'אולגה', 'מירונוב', 'vered.asres@example.com'],
  },
  {
    id: 'english',
    font: 'Arial',
    dir: 'ltr',
    text: `Psychological Evaluation Summary
Name: Daniel Whitford, DOB 03/09/2014, MRN 55120873.
Address: 41 Juniper Lane, Ashbury. Phone: (617) 555-0148.
Daniel was referred by his school counselor at Maple Grove Elementary for attention concerns. His mother, Karen Whitford, reports that he has trouble falling asleep and is easily frustrated with homework.
On the WISC-V his Full Scale IQ was 98. Teacher ratings on the Conners 3 were elevated for inattention. He is followed by Dr. Priya Raman at Northside Pediatrics.`,
    ids: ['Daniel', 'Whitford', '03/09/2014', '55120873', '41 Juniper Lane', 'Ashbury', '(617) 555-0148', 'Maple Grove', 'Karen', 'Priya', 'Raman', 'Northside'],
  },
];

// dpi: print resolution. The rest roughen the image after printing.
export const CONDITIONS = {
  clean300: { dpi: 300 },
  scan200: { dpi: 200, rotate: 1.2, noise: 18, gray: 0.92 },
  fax150: { dpi: 150, rotate: 0.6, noise: 40, blur: 0.5, threshold: 150 },
  photo: { dpi: 200, rotate: 2.5, noise: 25, blur: 0.9, light: 0.35, jpeg: 0.55 },
};

const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;');

// → PNG Buffer of one A4-width page holding the sample, roughened per condition.
export async function makeScan(ctx, sample, cond) {
  const z = cond.dpi / 96; // CSS zoom stands in for print resolution
  const page = await ctx.newPage();
  await page.setViewportSize({ width: Math.ceil(794 * z), height: Math.ceil(1123 * z) });
  const lines = sample.text.split('\n').map((l, i) => (i === 0 ? `<h1>${esc(l)}</h1>` : `<p>${esc(l)}</p>`)).join('');
  await page.setContent(`<html dir="${sample.dir || 'rtl'}" lang="${sample.dir === 'ltr' ? 'en' : 'he'}"><body style="margin:0;background:#fff">
    <div id="sheet" style="zoom:${z};width:794px;padding:72px 76px;box-sizing:border-box;font:16px '${sample.font}';color:#111;line-height:1.5">
    <style>h1{font-size:22px;margin:0 0 14px}p{margin:0 0 8px}</style>${lines}</div></body></html>`);
  const png = await page.locator('#sheet').screenshot({ type: 'png' });
  const out = await page.evaluate(async ({ b64, c }) => {
    const img = new Image();
    img.src = `data:image/png;base64,${b64}`;
    await img.decode();
    const cv = document.createElement('canvas');
    cv.width = img.width; cv.height = img.height;
    const g = cv.getContext('2d');
    g.fillStyle = '#fff'; g.fillRect(0, 0, cv.width, cv.height);
    if (c.blur) g.filter = `blur(${c.blur}px)`;
    g.translate(cv.width / 2, cv.height / 2);
    g.rotate(((c.rotate || 0) * Math.PI) / 180);
    g.drawImage(img, -img.width / 2, -img.height / 2);
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.filter = 'none';
    const d = g.getImageData(0, 0, cv.width, cv.height);
    let seed = 7;
    const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    for (let y = 0; y < cv.height; y++) {
      for (let x = 0; x < cv.width; x++) {
        const i = (y * cv.width + x) * 4;
        let v = d.data[i];
        if (c.gray) v = v * c.gray;
        if (c.light) v = v * (1 - c.light * (x / cv.width) * (y / cv.height));
        if (c.noise) v += (rnd() - 0.5) * c.noise;
        if (c.threshold) v = v < c.threshold ? 0 : 255;
        d.data[i] = d.data[i + 1] = d.data[i + 2] = Math.max(0, Math.min(255, v));
      }
    }
    g.putImageData(d, 0, 0);
    return cv.toDataURL(c.jpeg ? 'image/jpeg' : 'image/png', c.jpeg || undefined).split(',')[1];
  }, { b64: png.toString('base64'), c: cond });
  await page.close();
  return { buffer: Buffer.from(out, 'base64'), mime: cond.jpeg ? 'image/jpeg' : 'image/png' };
}

// → PDF Buffer whose pages are just the given images (no text layer), like a scanner makes.
export async function imagesToPdf(ctx, images) {
  const page = await ctx.newPage();
  const imgs = images.map((im) => `<img src="data:${im.mime};base64,${im.buffer.toString('base64')}" style="width:100%;display:block;break-after:page">`).join('');
  await page.setContent(`<html><body style="margin:0">${imgs}</body></html>`);
  await page.waitForFunction(() => [...document.images].every((i) => i.complete));
  const pdf = await page.pdf({ format: 'A4', margin: { top: 0, bottom: 0, left: 0, right: 0 } });
  await page.close();
  return pdf;
}
