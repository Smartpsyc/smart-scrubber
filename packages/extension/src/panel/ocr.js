// Read text from page images (scanned PDFs, photos), on this computer.
// Tesseract runs in a worker from files bundled in the extension (see
// ocr-worker.js and tools/build.mjs); nothing is downloaded or uploaded.

import { prepareForOcr } from './ocr-prep.js';

const IDLE_MS = 60_000; // the worker holds ~100 MB: let it go when unused
let workerP = null;
let idle = null;

function getWorker() {
  clearTimeout(idle);
  if (!workerP) {
    workerP = (async () => {
      const { default: Tesseract } = await import('../vendor/tesseract/tesseract.esm.min.js');
      // createWorker() never settles when loading fails; errorHandler is how we hear of it.
      let fail;
      const failed = new Promise((_, reject) => { fail = reject; });
      const worker = Tesseract.createWorker('heb+eng', 1 /* LSTM only */, {
        errorHandler: (e) => fail(new Error(`OCR: ${e}`)),
        workerPath: new URL('./ocr-worker.js', import.meta.url).href,
        workerBlobURL: false,
        corePath: new URL('../vendor/tesseract/core/', import.meta.url).href,
        langPath: 'local',
        gzip: true,
        cacheMethod: 'none',
      });
      return Promise.race([worker, failed]);
    })();
    workerP.catch(() => { workerP = null; });
  }
  return workerP;
}

function releaseSoon() {
  clearTimeout(idle);
  idle = setTimeout(async () => {
    const p = workerP;
    workerP = null;
    try { await (await p)?.terminate(); } catch { /* already gone */ }
  }, IDLE_MS);
}

// canvas (or OffscreenCanvas) → text
export async function ocrCanvas(canvas) {
  const worker = await getWorker();
  try {
    const { data } = await worker.recognize(prepareForOcr(canvas));
    return ocrText(data.text);
  } finally {
    releaseSoon();
  }
}

// An image file → a canvas. Large photos are scaled down to ~300 DPI A4 size.
export async function imageToCanvas(file) {
  const bmp = await createImageBitmap(file);
  const max = 3600;
  const k = Math.min(1, max / Math.max(bmp.width, bmp.height));
  const cv = document.createElement('canvas');
  cv.width = Math.round(bmp.width * k);
  cv.height = Math.round(bmp.height * k);
  const g = cv.getContext('2d', { willReadFrequently: true });
  g.fillStyle = '#fff';
  g.fillRect(0, 0, cv.width, cv.height);
  g.drawImage(bmp, 0, 0, cv.width, cv.height);
  bmp.close();
  return cv;
}

// Tesseract's text → the article's text: drop direction marks, and re-join lines
// the page wrapped mid-sentence (a name split over two lines must stay one name).
export function ocrText(raw) {
  const clean = raw.replace(/[‎‏‪-‮⁦-⁩]/g, '').replace(/[ \t]+/g, ' ');
  return clean.split(/\n\s*\n/).map((block) => {
    const lines = block.split('\n').map((l) => l.trim()).filter(Boolean);
    const long = Math.max(0, ...lines.map((l) => l.length));
    const out = [];
    for (const l of lines) {
      const prev = out[out.length - 1];
      const wrapped = prev !== undefined && prev.length >= long * 0.6 && !/[.:!?;]$/.test(prev) && !/^([-–•*]|\d+[.)])\s/.test(l);
      if (wrapped) out[out.length - 1] = `${prev} ${l}`;
      else out.push(l);
    }
    return out.join('\n');
  }).filter(Boolean).join('\n\n').trim();
}
