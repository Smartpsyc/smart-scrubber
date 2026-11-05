// Read an article from a local file, entirely in this panel. Nothing is uploaded:
// mammoth (Word) and pdf.js (PDF) are bundled under vendor/, and the panel's CSP
// blocks every network request (connect-src 'none').
//
// extractFile(file) → { text, pages? , warning? } or throws Error(code) with
// code in: too-big | unsupported | scanned | unreadable.

const MAX_BYTES = 25 * 1024 * 1024;
const HEB = /[֐-׿]/;

export async function extractFile(file) {
  if (file.size > MAX_BYTES) throw new Error('too-big');
  const name = file.name.toLowerCase();
  try {
    if (name.endsWith('.txt') || name.endsWith('.md') || file.type === 'text/plain') return { text: tidy(await file.text()) };
    if (name.endsWith('.docx')) return await fromDocx(file);
    if (name.endsWith('.pdf') || file.type === 'application/pdf') return await fromPdf(file);
  } catch (e) {
    if (['scanned'].includes(e.message)) throw e;
    console.warn('[scrubber] could not read file', e); // local console only
    throw new Error('unreadable');
  }
  throw new Error('unsupported');
}

const tidy = (s) => s.replace(/\r\n?/g, '\n').replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim();

// ---------- Word ----------

async function fromDocx(file) {
  const mammoth = globalThis.mammoth;
  if (!mammoth) throw new Error('unreadable');
  const { value: html } = await mammoth.convertToHtml({ arrayBuffer: await file.arrayBuffer() });
  return { text: tidy(htmlToMarkdown(html)) };
}

// Keeps the structure Claude needs (headings, lists, tables) as plain Markdown.
export function htmlToMarkdown(html) {
  const doc = new DOMParser().parseFromString(`<body>${html}</body>`, 'text/html');
  return blocks(doc.body, 0);
}

function inline(node) {
  let s = '';
  for (const n of node.childNodes) {
    if (n.nodeType === Node.TEXT_NODE) { s += n.nodeValue; continue; }
    if (n.nodeType !== Node.ELEMENT_NODE) continue;
    const t = n.tagName;
    if (t === 'BR') s += '\n';
    else if (t === 'STRONG' || t === 'B') { const x = inline(n); s += x.trim() ? `**${x}**` : x; }
    else if (t === 'EM' || t === 'I') { const x = inline(n); s += x.trim() ? `*${x}*` : x; }
    else if (t === 'IMG') continue;
    else s += inline(n);
  }
  return s;
}

function blocks(node, depth) {
  const out = [];
  for (const n of node.children) {
    const t = n.tagName;
    if (/^H[1-6]$/.test(t)) out.push('#'.repeat(Number(t[1])) + ' ' + inline(n).trim());
    else if (t === 'P') out.push(inline(n).trim());
    else if (t === 'UL' || t === 'OL') out.push(list(n, depth));
    else if (t === 'TABLE') out.push(table(n));
    else if (t === 'BLOCKQUOTE') out.push(blocks(n, depth).split('\n').map((l) => '> ' + l).join('\n'));
    else if (n.children.length) out.push(blocks(n, depth));
    else if (n.textContent.trim()) out.push(inline(n).trim());
  }
  return out.filter(Boolean).join('\n\n');
}

function list(n, depth) {
  const ordered = n.tagName === 'OL';
  let i = 1;
  return [...n.children].filter((li) => li.tagName === 'LI').map((li) => {
    const nested = [...li.children].filter((c) => c.tagName === 'UL' || c.tagName === 'OL');
    const clone = li.cloneNode(true);
    for (const c of [...clone.children]) if (c.tagName === 'UL' || c.tagName === 'OL') c.remove();
    const line = `${'  '.repeat(depth)}${ordered ? `${i++}.` : '-'} ${inline(clone).replace(/\s+/g, ' ').trim()}`;
    return [line, ...nested.map((c) => list(c, depth + 1))].join('\n');
  }).join('\n');
}

function table(t) {
  const rows = [...t.querySelectorAll('tr')].map((tr) => [...tr.children].map((c) => inline(c).replace(/\s+/g, ' ').trim().replace(/\|/g, '\\|')));
  if (!rows.length) return '';
  const w = Math.max(...rows.map((r) => r.length));
  const pad = (r) => [...r, ...Array(w - r.length).fill('')];
  return [`| ${pad(rows[0]).join(' | ')} |`, `| ${Array(w).fill('---').join(' | ')} |`, ...rows.slice(1).map((r) => `| ${pad(r).join(' | ')} |`)].join('\n');
}

// ---------- PDF ----------

let pdfjsPromise = null;
function pdfjs() {
  pdfjsPromise ||= import('../vendor/pdfjs/pdf.min.mjs').then((lib) => {
    lib.GlobalWorkerOptions.workerSrc = new URL('../vendor/pdfjs/pdf.worker.min.mjs', import.meta.url).href;
    return lib;
  });
  return pdfjsPromise;
}

async function fromPdf(file) {
  const lib = await pdfjs();
  const task = lib.getDocument({
    data: new Uint8Array(await file.arrayBuffer()),
    isEvalSupported: false,
    // Nothing may be fetched: no CMaps, no standard-font data, no wasm decoders.
    cMapUrl: null,
    standardFontDataUrl: null,
    wasmUrl: null,
    useSystemFonts: false,
    disableFontFace: true,
    stopAtErrors: false,
  });
  const doc = await task.promise;
  const pages = [];
  for (let p = 1; p <= doc.numPages; p++) {
    const page = await doc.getPage(p);
    const content = await page.getTextContent();
    pages.push(pageText(content.items));
    page.cleanup();
  }
  await task.destroy();
  const text = tidy(pages.join('\n\n'));
  // A scan has (almost) no text layer. OCR comes in a later version.
  if (text.replace(/\s/g, '').length < 20 * doc.numPages) throw new Error('scanned');
  return { text: fixVisualHebrew(text), pages: doc.numPages };
}

// Group text items into lines by baseline, and lines into paragraphs by gap.
// Right-to-left lines: PDF writers emit the pieces in visual (left→right) order,
// so a Hebrew sentence ending in a number comes out as ".123 עברית". Re-order
// such lines by position from the right, and move punctuation that leads a
// left-to-right piece (visually the sentence end) back after it.
function pageText(items) {
  const lines = [];
  let cur = null;
  for (const it of items) {
    if (!('str' in it)) continue;
    const y = it.transform[5];
    const h = Math.abs(it.transform[3]) || it.height || 10;
    if (!cur || Math.abs(cur.y - y) > h * 0.5) {
      cur = { y, h, parts: [] };
      lines.push(cur);
    }
    cur.parts.push({ str: it.str, x: it.transform[4], w: it.width || 0, dir: it.dir });
    if (it.hasEOL) cur = null;
  }
  const out = [];
  let prev = null;
  for (const l of lines) {
    const s = lineText(l.parts).replace(/\s+/g, ' ').trim();
    if (!s) continue;
    if (prev && prev.y - l.y > prev.h * 1.8) out.push('');
    out.push(s);
    prev = l;
  }
  return out.join('\n');
}

function lineText(parts) {
  const heb = parts.reduce((n, p) => n + (p.str.match(/[\u0590-\u05FF]/g) || []).length, 0);
  const lat = parts.reduce((n, p) => n + (p.str.match(/[A-Za-z]/g) || []).length, 0);
  if (heb <= lat) return parts.map((p) => p.str).join('');
  return [...parts]
    .sort((a, b) => (b.x + b.w) - (a.x + a.w))
    .map((p) => (HEB.test(p.str) ? p.str : p.str.replace(/^([.,:;!?]+)(\S.*)$/s, '$2$1')))
    .join('');
}

// Some PDFs store Hebrew in visual (left-to-right, reversed) order. Telltale:
// final letters (ך ם ן ף ץ) at the START of words instead of the end. If that
// dominates, reverse each Hebrew line, then put numbers/Latin runs back in order.
const FINALS = /[ךםןףץ]/;
export function fixVisualHebrew(text) {
  let atStart = 0, atEnd = 0;
  for (const w of text.match(/[א-ת]{2,}/g) || []) {
    if (FINALS.test(w[0])) atStart++;
    if (FINALS.test(w[w.length - 1])) atEnd++;
  }
  if (atStart <= atEnd * 2 || atStart < 3) return text;
  return text.split('\n').map((line) => {
    if (!HEB.test(line)) return line;
    const rev = [...line].reverse().join('');
    return rev.replace(/[A-Za-z0-9][A-Za-z0-9.,:/\-+%@]*[A-Za-z0-9]|[A-Za-z0-9]/g, (run) => [...run].reverse().join(''))
      .replace(/[()[\]{}<>]/g, (c) => ({ '(': ')', ')': '(', '[': ']', ']': '[', '{': '}', '}': '{', '<': '>', '>': '<' })[c]);
  }).join('\n');
}
