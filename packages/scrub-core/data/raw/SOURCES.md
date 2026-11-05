# Data sources (open data, data.gov.il)

| File | Dataset | Publisher | License | Fetched |
|------|---------|-----------|---------|---------|
| `registry-first-names.txt` | שמות פרטיים בישראל (`firs-name`, resource c4fb2685-381f-4e99-a88e-b9b7ed703117) — all first names in the population registry, as of 14.9.2020 | רשות האוכלוסין וההגירה | Other (Open) | 2026-11-05 |
| `cbs-localities.tsv` | רשימת יישובים (resource 5c78e9fa-c2e2-4771-93ff-7f400a12f7ba) — Hebrew + CBS English name | הלמ"ס via data.gov.il | Other (Open) | 2026-11-05 |

The registry list has no gender or frequency and contains misspellings; auto mode uses it only to confirm that a
word right after a cue ("אמו X") is a name. Regenerate the bundled modules with `node tools/build-data.mjs`.
