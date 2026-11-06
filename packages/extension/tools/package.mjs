// Builds dist/ and zips it for the Chrome Web Store: node tools/package.mjs
// → release/smart-scrubber-v<version>.zip (upload this file in the developer dashboard).
import { execFileSync } from 'node:child_process';
import { readFileSync, mkdirSync, rmSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
execFileSync('node', [join(root, 'tools', 'build.mjs')], { stdio: 'inherit' });
const { version } = JSON.parse(readFileSync(join(root, 'dist', 'manifest.json'), 'utf8'));
const out = join(root, 'release', `smart-scrubber-v${version}.zip`);
mkdirSync(join(root, 'release'), { recursive: true });
rmSync(out, { force: true });
execFileSync('zip', ['-q', '-r', '-X', out, '.', '-x', '.DS_Store', '*/.DS_Store'], { cwd: join(root, 'dist') });
console.log(`packaged ${out}`);
