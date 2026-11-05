// Test files built on the fly: a minimal .docx (stored zip, no deps) and PDFs
// printed by Chromium itself (a text-layer Hebrew PDF and an image-only "scan").

const CRC = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();
const crc32 = (buf) => {
  let c = 0xffffffff;
  for (const b of buf) c = CRC[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
};

export function zipStored(files) {
  const local = [];
  const central = [];
  let offset = 0;
  for (const [name, text] of Object.entries(files)) {
    const data = Buffer.from(text, 'utf8');
    const nameBuf = Buffer.from(name, 'utf8');
    const crc = crc32(data);
    const h = Buffer.alloc(30);
    h.writeUInt32LE(0x04034b50, 0); h.writeUInt16LE(20, 4); h.writeUInt16LE(0x0800, 6); h.writeUInt16LE(0, 8);
    h.writeUInt32LE(crc, 14); h.writeUInt32LE(data.length, 18); h.writeUInt32LE(data.length, 22);
    h.writeUInt16LE(nameBuf.length, 26);
    local.push(h, nameBuf, data);
    const c = Buffer.alloc(46);
    c.writeUInt32LE(0x02014b50, 0); c.writeUInt16LE(20, 4); c.writeUInt16LE(20, 6); c.writeUInt16LE(0x0800, 8);
    c.writeUInt32LE(crc, 16); c.writeUInt32LE(data.length, 20); c.writeUInt32LE(data.length, 24);
    c.writeUInt16LE(nameBuf.length, 28); c.writeUInt32LE(offset, 42);
    central.push(c, nameBuf);
    offset += 30 + nameBuf.length + data.length;
  }
  const cd = Buffer.concat(central);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0); end.writeUInt16LE(Object.keys(files).length, 8); end.writeUInt16LE(Object.keys(files).length, 10);
  end.writeUInt32LE(cd.length, 12); end.writeUInt32LE(offset, 16);
  return Buffer.concat([...local, cd, end]);
}

const W = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main';
const run = (t, bold) => `<w:r>${bold ? '<w:rPr><w:b/></w:rPr>' : ''}<w:t xml:space="preserve">${t}</w:t></w:r>`;
const para = (...runs) => `<w:p>${runs.join('')}</w:p>`;
const cell = (t) => `<w:tc><w:p>${run(t)}</w:p></w:tc>`;

export function makeDocx() {
  const body = [
    para(run('נועה כהן', true), run(' הגיעה עם אמה מקריית אונו.')),
    para(run('ת.ז. 123456782, נולדה 12/03/2015.')),
    `<w:tbl><w:tr>${cell('שם')}${cell('נועה כהן')}</w:tr><w:tr>${cell('יישוב')}${cell('קריית אונו')}</w:tr></w:tbl>`,
  ].join('');
  return zipStored({
    '[Content_Types].xml': '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>',
    '_rels/.rels': '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>',
    'word/document.xml': `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:document xmlns:w="${W}"><w:body>${body}</w:body></w:document>`,
  });
}

export async function makePdfs(ctx) {
  const page = await ctx.newPage();
  await page.setContent(`<html dir="rtl" lang="he"><body style="font: 16px Arial">
    <h1>סיכום הערכה</h1>
    <p>נועה כהן הגיעה עם אמה מקריית אונו. ת.ז. 123456782.</p>
    <p>נועה סיפרה שהיא ישנה רע מאז ספטמבר 2023.</p>
  </body></html>`);
  const text = await page.pdf({ format: 'A4' });
  await page.setContent(`<html><body><canvas id="c" width="600" height="200"></canvas><img id="i"></body></html>`);
  await page.evaluate(() => {
    const c = document.getElementById('c');
    const g = c.getContext('2d');
    g.fillStyle = '#fff'; g.fillRect(0, 0, 600, 200); g.fillStyle = '#000'; g.font = '30px Arial';
    g.fillText('scanned page: no text layer', 20, 100);
    const img = document.getElementById('i');
    img.src = c.toDataURL();
    c.remove();
  });
  await page.waitForFunction(() => document.getElementById('i').complete);
  const scan = await page.pdf({ format: 'A4' });
  await page.close();
  return { text, scan };
}
