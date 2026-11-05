// Downloads the two open-data sources into data/raw/ (not committed).
// Then run `node tools/build-data.mjs` to regenerate src/auto/registry.js
// and src/auto/localities.js. See data/SOURCES.md.
import { mkdirSync, writeFileSync } from 'node:fs';
const root = new URL('..', import.meta.url).pathname;
const API = 'https://data.gov.il/api/3/action/datastore_search';

async function all(resource) {
  const out = [];
  for (let offset = 0; ; ) {
    const r = await fetch(`${API}?resource_id=${resource}&limit=32000&offset=${offset}`);
    if (!r.ok) throw new Error(`${resource}: HTTP ${r.status}`);
    const recs = (await r.json()).result.records;
    if (!recs.length) return out;
    out.push(...recs);
    offset += recs.length;
  }
}

mkdirSync(root + 'data/raw', { recursive: true });
const names = await all('c4fb2685-381f-4e99-a88e-b9b7ed703117');
writeFileSync(root + 'data/raw/registry-first-names.txt', names.map((x) => String(x['שם פרטי']).trim()).join('\n'));
const locs = await all('5c78e9fa-c2e2-4771-93ff-7f400a12f7ba');
writeFileSync(root + 'data/raw/cbs-localities.tsv', locs.map((x) => `${String(x['שם_ישוב']).trim()}\t${String(x['שם_ישוב_לועזי']).trim()}`).join('\n'));
console.log('names', names.length, 'localities', locs.length);
