# smart-scrubber

A browser extension (in progress) that lets clinicians work on case material in claude.ai without real identifiers
leaving their machine: anonymize the article once (names, IDs, phones, emails, addresses and dates become realistic
stand-ins), work with the anonymous version inside Claude, then restore the identifiers in the final output, locally. Hebrew and English. No server, no network calls of its own.

**Risk reduction, not anonymization or compliance.** See the threat model in
[`packages/scrub-core/README.md`](packages/scrub-core/README.md#threat-model).

| Part | Status |
|------|--------|
| [`packages/scrub-core`](packages/scrub-core) — engine: scrub / restore / leak guard, manual + auto mode | Working, 75 tests, zero dependencies |
| [`packages/extension`](packages/extension) — Chrome side panel for claude.ai | Working against a mock page (14 end-to-end tests); Word/PDF/text files, scans and photos (Hebrew + English OCR) read locally |

```
cd packages/scrub-core && npm test
cd packages/extension && npm install && npx playwright install chromium && npm test
```

By [SmartPsyc](https://smartpsyc.com). Licensed under [Apache-2.0](LICENSE). Bundles Israeli open data with
attribution: see [`packages/scrub-core/data/SOURCES.md`](packages/scrub-core/data/SOURCES.md).
