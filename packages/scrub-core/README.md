# scrub-core

Local, dependency-free engine that swaps identifiers in Hebrew and English clinical text for realistic
surrogates before the text goes to an AI chat, and restores the real identifiers in the reply.
Everything runs on the clinician's machine. There is no network code in this package.

**This is risk reduction, not anonymization or compliance.** It does not make a consumer AI plan
HIPAA-compliant, and it cannot remove indirect identifiers (a rare event, a small town, a distinctive story).

## What it does

| Kind | How it's found | Replaced with |
|------|----------------|---------------|
| People (client, parents, siblings, teachers…) | Declared by the clinician, with gender | A fake name of the **same gender** (Hebrew grammar stays right), in both scripts |
| Nicknames | Declared | A matching diminutive of the surrogate (אסתר → אסתי) where one exists |
| Surnames | Declared | A fake surname, shared across the family |
| Town, school | Declared | A plausible surrogate of the same type; "בית ספר", "גן", "High School" are kept |
| Job title, other details | Declared | The clinician's own text (e.g. "עובד ציבור"), or a numbered token `[תפקיד 1]` / `[פרט 1]` |
| Israeli ID | Pattern, **checksum-validated** (ordinary numbers are left alone) | `[ת.ז. 1]` / `[ID 1]` |
| Phone, email, URL, street address | Pattern | `[טלפון 1]`, `[EMAIL 1]`, … (the same value always gets the same number) |
| Dates | Pattern (numeric, ISO, Hebrew and English month names) | Shifted by one per-case offset, in **whole weeks** (weekdays, intervals and ages stay right), same format |

Hebrew specifics: prefix clitics (ו/ה/ב/כ/ל/מ/ש and combinations like וכש, plus `ל-נועה`) are kept on the surrogate
and handled again on restore; niqqud and geresh variants match; a Hebrew prefix glued to an English name (`לNoa`)
is caught. Claude may answer in the other language: every surrogate exists in both scripts and restores into the real
name's matching spelling.

`community: 'arab'` (per case or per entity) draws surrogates from an Arab-community pool, so an Arab family stays
an Arab family in the scrubbed text.

Not touched on purpose: numeric day/month without a year (`7/10` is usually a score), bare years, ranges.

## API

```js
import { createCase, addEntities, scrub, restore, legend, buildGuard, findLeaks } from 'scrub-core';

let kase = createCase({
  community: 'general',            // or 'arab'
  entities: [
    { kind: 'person', role: 'client', gender: 'f',
      first: { he: 'נועה', en: 'Noa' }, last: { he: 'כהן', en: 'Cohen' }, nicknames: [{ he: 'נועי' }] },
    { kind: 'town', he: 'קריית אונו', en: 'Kiryat Ono' },
    { kind: 'school', he: 'בית ספר אלונים' },
    { kind: 'job', he: 'קצין משטרה', replacement: { he: 'עובד ציבור', en: 'civil servant' } },
  ],
});

const r = scrub(text, kase);   // { text, spans, newMappings, warnings, residual, case }
kase = r.case;                 // functions never mutate; keep the returned case
if (r.residual.length) { /* fail closed: do not send */ }

const back = restore(claudeReply, kase);   // { text, spans, unresolved }
legend(kase);                               // [{ real, surrogate: { he, en } }] for a "Rivka = Noa" key
```

- `restore(scrub(x).text) === x` for declared primary spellings (tested on the whole corpus).
- Dates Claude restates in another format ("October 17, 2023", "October 2023") are restored by value;
  dates the case never produced are left alone.
- `warnings`: `surrogate-in-text` (a later message contains an existing surrogate), `nickname-shares-surrogate`,
  `pool-exhausted` (fell back to `[אדם 1]`), `date-ambiguous`.

### Leak guard

```js
const guard = buildGuard([kase], salt);   // { salt, lengths, hashes } — no plaintext identifiers
findLeaks(outgoingRequestBody, guard);    // [] or [{ label: 'e1.first', index }]
```

Scans any request body (JSON, including `\uXXXX` escapes) for declared identifiers, with Hebrew prefixes and
English possessives, plus undeclared checksum-valid IDs, IL phones and emails. Uses a built-in SHA-256 so it
doesn't depend on `crypto.subtle` in a page world that page scripts could patch.

## Auto mode (for users in a rush)

```js
const { suggestions } = suggest(text, kase);   // chips: people, surnames, nicknames, towns, schools, English spellings
const r = autoScrub(text, kase);               // accept all suggestions, then scrub
```

Finds people, surnames, nicknames, towns and schools with nothing declared, and turns accepted suggestions into
case entities (so later messages and the leak guard cover them). How it decides:

- **Curated lexicon** (`src/auto/lexicon.js`): ~900 first names with gender and paired he/en spellings (Israeli, Arab,
  Russian-speaking, English), ~250 surnames, cue words, gender-agreement markers.
- **Population-registry first names** (116,671, open data) to confirm a word after a cue is a name ("אמו רחל" yes,
  "אמו אמרה" no). **CBS localities** (1,316, he + en, with spelling variants like קרית/קריית).
- **Rules:** name followed by an age ("ראמז חלבי, בן 15"); cue words before (אמו, המורה, גב', ד"ר, Mrs., …), with an
  optional adjective ("אחותה הגדולה שרי"); a relation word after ("איתן, אחיו של…"); a verb right after a word-name
  ("נועם הגיעה"); quoted/bracketed nicknames; "goes by"; English place phrases ("lives in", "School in").
- **Names that are everyday words** (אור, שירה, מיכל, דוד, מזרחי; Grace, Will) count only with one of those signals.
  **Single-word localities** count alone only if on a hand-checked list of distinctive names (חיפה, סח'נין);
  the rest (רחוב, מצליח, חוסן, שירה…) need a town cue.
- **Gender** of unisex names from agreement after the name; otherwise the chip asks.
- **English spellings** of Hebrew names by consonant skeleton (ולנטינה ↔ Valentina, ≥3 consonants).
- Job titles are **not** auto-detected (manual field).

**Measured recall** (share of real name/place mentions removed, nothing declared):

| Set | Recall | False alarms | Note |
|-----|--------|--------------|------|
| `test/corpus.js` (112 notes) | 100% (556/556) | 0 | rules were tuned on it: optimistic |
| `test/heldout.js` (24 notes) | 96.2% (75/78) | 1 | informed the general rules after a 53.8% first run |
| `test/heldout2.js` (19 notes) | **85.5% (53/62)** | 2 | written after the rules froze, never tuned on: **the honest number** |

Known misses (set 2): word-names with no cue ("כשאבי יחזור"), word-like towns with no nearby cue ("מנתיבות"),
neighbourhoods (not in any list), 2-consonant English surnames. **Manual mode remains the reliable path**, and the
preview must stay in front of the clinician in auto mode.

## Threat model

**Protects against:** declared and pattern-detectable identifiers reaching the AI provider from this browser profile.

**Does not protect against:**
- Indirect identifiers in the narrative; names the clinician never declared that no pattern catches.
- Images, screenshots, voice; text sent from another device or browser, or before installing.
- AI memory or project knowledge from earlier unscrubbed chats.
- A compromised browser or machine.
- **Hash brute force:** names are low-entropy. Salted hashes keep identifiers out of logs, crash reports and casual
  inspection of the page; a page script deliberately hashing a list of Israeli names against the salt could recover them.

## Data

Auto mode bundles two Israeli open-data sets, used with attribution (details in `data/SOURCES.md`):
- First names in the population registry, published by the **Population and Immigration Authority** on data.gov.il.
- The list of localities, published by the **Central Bureau of Statistics** on data.gov.il.

`node tools/fetch-data.mjs` downloads them into `data/raw/` (not committed); `node tools/build-data.mjs` regenerates
`src/auto/registry.js` and `src/auto/localities.js`.

## Tests

```
npm test        # node --test, no dependencies (prints auto-mode recall per set)
```

The gate is `test/corpus.test.js`: 112 synthetic notes (5 Hebrew-speaking families incl. an Arab family, 1 English-only
family, hand-written mixed-script notes), asserting for every note: **zero leaks** (checked by an independent matcher),
empty self-check residual, exact round trip, the guard is clean on the scrubbed text and catches the raw text.
All names, numbers and addresses in the corpus are invented.

## License

Apache-2.0
