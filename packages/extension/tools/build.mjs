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
