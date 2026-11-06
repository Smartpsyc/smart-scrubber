// Assemble the unpacked extension: src/ + a vendored copy of scrub-core.
// No bundler: the panel loads scrub-core as native ES modules.
//
//   node tools/build.mjs          → dist/       (claude.ai only)
//   node tools/build.mjs --test   → dist-test/  (also matches http://localhost, for the mock page)

import { cpSync, rmSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const test = process.argv.includes('--test');
const out = join(root, test ? 'dist-test' : 'dist');

rmSync(out, { recursive: true, force: true });
mkdirSync(out, { recursive: true });
cpSync(join(root, 'src'), out, { recursive: true });
cpSync(join(root, '..', 'scrub-core', 'src'), join(out, 'vendor', 'scrub-core'), { recursive: true });
cpSync(join(root, '..', '..', 'LICENSE'), join(out, 'LICENSE'));

// File readers, bundled so nothing is ever fetched at run time (MV3 forbids
// remote code anyway, and the panel's CSP blocks all network access).
const nm = join(root, 'node_modules');
const vendor = (from, to) => cpSync(join(nm, from), join(out, 'vendor', to));
vendor('mammoth/mammoth.browser.min.js', 'mammoth/mammoth.browser.min.js');
vendor('mammoth/LICENSE', 'mammoth/LICENSE');
vendor('pdfjs-dist/build/pdf.min.mjs', 'pdfjs/pdf.min.mjs');
vendor('pdfjs-dist/build/pdf.worker.min.mjs', 'pdfjs/pdf.worker.min.mjs');
vendor('pdfjs-dist/LICENSE', 'pdfjs/LICENSE');
// Scanned PDFs store pages as CCITT/JBIG2/JPEG 2000 images. pdf.js decodes them
// with wasm it would fetch; the plain-JS fallbacks are imported instead (useWasm: false).
for (const f of ['jbig2_nowasm_fallback.js', 'openjpeg_nowasm_fallback.js', 'LICENSE_JBIG2', 'LICENSE_PDFJS_JBIG2', 'LICENSE_OPENJPEG', 'LICENSE_PDFJS_OPENJPEG']) {
  vendor(`pdfjs-dist/wasm/${f}`, `pdfjs/wasm/${f}`);
}

// OCR for scans: Tesseract (Apache-2.0), its wasm core (SIMD builds only, as every
// Chrome this extension supports has SIMD; LSTM engine only;
// the .wasm.js files carry the wasm inside them) and the Hebrew + English models.
// The models become scripts the OCR worker loads with importScripts, so nothing
// is fetched (the CSP's connect-src stays 'none').
vendor('tesseract.js/dist/tesseract.esm.min.js', 'tesseract/tesseract.esm.min.js');
vendor('tesseract.js/dist/worker.min.js', 'tesseract/worker.min.js');
vendor('tesseract.js/LICENSE.md', 'tesseract/LICENSE.md');
for (const f of ['tesseract-core-relaxedsimd-lstm.wasm.js', 'tesseract-core-simd-lstm.wasm.js', 'LICENSE']) {
  vendor(`tesseract.js-core/${f}`, `tesseract/core/${f}`);
}
for (const lang of ['heb', 'eng']) {
  const gz = readFileSync(join(nm, '@tesseract.js-data', lang, '4.0.0_best_int', `${lang}.traineddata.gz`));
  writeFileSync(join(out, 'vendor', 'tesseract', `lang-${lang}.js`),
    `// ${lang}.traineddata.gz (tessdata_best, integer) from @tesseract.js-data/${lang} (MIT; models Apache-2.0)\n`
    + `self.TESS_LANG = self.TESS_LANG || {};\nself.TESS_LANG.${lang} = "${gz.toString('base64')}";\n`);
}
writeFileSync(join(out, 'vendor', 'tesseract', 'LANG-DATA-NOTICE.txt'),
  'lang-heb.js and lang-eng.js hold heb/eng.traineddata from github.com/tesseract-ocr/tessdata_best\n'
  + '(Apache License 2.0), as packaged in the npm packages @tesseract.js-data/heb and /eng (MIT).\n');

const manifestPath = join(out, 'manifest.json');
const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
if (test) {
  const LOCAL = 'http://localhost/*';
  manifest.name += ' (test build)';
  manifest.host_permissions.push(LOCAL);
  manifest.content_scripts[0].matches.push(LOCAL);
}
writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + '\n');
console.log(`built ${out}`);
