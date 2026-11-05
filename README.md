# smart-scrubber

A browser extension (in progress) that lets clinicians use claude.ai on case material without real identifiers
leaving their machine. Names, IDs, phones, emails, addresses and dates are swapped for realistic surrogates before
sending, and restored locally in Claude's reply. Hebrew and English. No server, no network calls of its own.

**Risk reduction, not anonymization or compliance.** See the threat model in
[`packages/scrub-core/README.md`](packages/scrub-core/README.md#threat-model).

| Part | Status |
|------|--------|
| [`packages/scrub-core`](packages/scrub-core) — engine: scrub / restore / leak guard, manual + auto mode | Working, 70 tests, zero dependencies |
| Chrome extension (side panel) | Not started |

```
cd packages/scrub-core && npm test
```

By [SmartPsyc](https://smartpsyc.com). Licensed under [Apache-2.0](LICENSE). Bundles Israeli open data with
attribution: see [`packages/scrub-core/data/SOURCES.md`](packages/scrub-core/data/SOURCES.md).
