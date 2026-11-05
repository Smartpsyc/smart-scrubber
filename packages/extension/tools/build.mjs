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
