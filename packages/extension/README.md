# Smart Scrubber: Chrome extension

A side panel for claude.ai, built around one workflow:

1. **Anonymize the article.** Paste it into the panel or drop in a Word, PDF or text file. New cases start in **Auto**:
   names and places are found for you, so in a rush it is paste and click. **Check and adjust** (folded under the article)
   holds the rest: what was found (untick mistakes), Manual mode with your own list of people and places, the
   highlighted preview, and the exact text Claude will get. Then **Put into Claude**: the anonymized text goes into Claude's message box, after
   anything you typed there. It never sends: you send it yourself. (A long article becomes a "pasted text" attachment,
   as claude.ai does with any long paste.) Or use **Copy anonymized**.
2. **Work in Claude.** Everything there is anonymous, so work as usual. The panel shows the key (real name → stand-in)
   so you can refer to people by their stand-in names.
3. **Bring back the final version.** Click **Restore real names** (in Claude's last reply), or paste anything copied from Claude
   (a reply, an artifact). The real identifiers come back in the panel, ready to copy or export.

The claude.ai page only ever holds the anonymized version. **Everything runs in your browser**: nothing is sent to any
server by the extension or by any library it bundles.

**Risk reduction, not anonymization or compliance.** See the threat model in [`../scrub-core/README.md`](../scrub-core/README.md#threat-model).

## Install (developer mode)

```
cd packages/extension
npm run build            # → dist/
```

Open `chrome://extensions`, turn on **Developer mode**, click **Load unpacked** and choose `packages/extension/dist`.
Pin the extension, open claude.ai, then click the toolbar icon to open the panel.

**After updating the code:** Chrome keeps running the old copy until you click the ↻ reload icon on the extension's card
in `chrome://extensions` (then reload the claude.ai tab). The panel header shows the running version (e.g. `v0.3.0`).

## How it works

| Piece | File | Notes |
|-------|------|-------|
| Side panel | `src/panel/` | Case fields (manual), suggestion chips (auto), preview, outgoing text, key, restore. English + Hebrew (RTL). |
| Engine | `vendor/scrub-core/` (copied in at build) | Same code as `packages/scrub-core`, loaded as native ES modules: no bundler. |
| File reading | `src/panel/files.js` + `vendor/mammoth`, `vendor/pdfjs` (copied in at build) | `.docx` via mammoth → Markdown (headings, lists, tables); `.pdf` via pdf.js text layer, with right-to-left line re-ordering for Hebrew; `.txt`/`.md`. All in the panel's memory. |
| OCR (scans, photos) | `src/panel/ocr.js`, `ocr-prep.js`, `ocr-worker.js` + `vendor/tesseract` | PDF pages with no text layer, and `.jpg`/`.png`/`.webp` photos, are read with Tesseract 5 (tesseract.js 7, Hebrew + English `tessdata_best` integer models, LSTM engine). Each page is rendered at 300 DPI, its lighting evened out and its tilt straightened, then read in a worker. Fax-style CCITT/JBIG2 and JPEG 2000 scans decode with pdf.js's bundled plain-JS decoders. The message after a scan asks you to check the names, because a misread name can't be matched. |
| Case store | `src/panel/store.js` | AES-GCM-256. The key is a **non-extractable** `CryptoKey` in IndexedDB; ciphertext in `chrome.storage.local`, keyed by Claude conversation id. Cases expire after 30 days (configurable). |
| claude.ai adapter | `src/content/claude-adapter.js` | **All claude.ai selectors live here.** Appends anonymized text to Claude's message box (synthetic paste), never clicks Send, reads the last finished reply on request (converted back to Markdown). |
| Service worker | `src/background.js` | Only opens the panel from the toolbar. Never sees case text. |

Guarantees you can check in the code:
- The panel's CSP is `default-src 'self'; connect-src 'none'` (plus `worker-src 'self'` for the bundled pdf.js and OCR
  workers, and `'wasm-unsafe-eval'` so the bundled Tesseract wasm can run): extension pages can load nothing from outside
  the extension and can't make network requests, not even to the extension's own files. pdf.js runs with eval, CMap,
  standard-font and wasm fetching all off. Tesseract's models ship as scripts inside the extension; its worker's
  `fetch` is replaced by one that only returns those bundled models and refuses everything else.
- The end-to-end tests record every request the panel (and its pdf.js and OCR workers) makes and fail on anything that isn't
  the extension's own files, or on any CSP refusal.
- The only permissions are `sidePanel`, `storage`, and host access to `https://claude.ai/*`.
- The content script receives only anonymized text, and never writes real names into the page.

**Fails closed.** If Claude's message box can't be found, **Put into Claude** is disabled ("Claude's page changed.
The scrubber is paused"); **Copy anonymized** still works. If the inserted text doesn't land exactly, you're told to clear the box
and retry. If a declared identifier or an ID/phone/email pattern would remain in the anonymized text, the panel lists it
as a warning above the buttons; you decide whether to fix it or send anyway.

New chats: the case is a draft until you send in Claude. When the chat gets its id (`/chat/<uuid>`) the case moves to it,
and reopens whenever you come back to that conversation.

## Not in this version yet

- Optional: a warning if a declared real name is typed straight into claude.ai by mistake. By design, what you type in Claude
  is not scrubbed: you work there with the stand-in names.

## Tests

```
npm test                 # builds dist-test/ and runs the end-to-end tests
```

The tests load the unpacked extension in Chromium (Playwright) and drive a **mock claude.ai page**
(`test/mock/claude-mock.html`). The mock copies the real page's structure as recorded on 2026-11-05. The tests cover:
- anonymizing before anything reaches the page (never auto-sending),
- adding the article after the clinician's own instructions,
- the encrypted store (no real name anywhere in `chrome.storage`),
- conversation binding,
- restoring through the button and the paste box (exact round trip), and Copy anonymized,
- the fail-closed states,
- auto-mode suggestions, tag-a-word, and the Hebrew RTL UI,
- a long article turning into a Claude attachment (counted as done, never sent, never duplicated),
- reading Word, a Hebrew PDF (made by Chromium), text files,
- OCR of fictional Hebrew scans: a two-page scanner PDF (flatbed + tilted phone photo), a JPEG photo, and a 1-bit
  CCITT G4 fax-style PDF (`test/files/scan-ccitt-g4.pdf`, made by `tools/make-ccitt-fixture.mjs`): every name, ID,
  date and place must come through, and then be scrubbed,
- zero network requests from the panel.

**OCR benchmark:** `node tools/ocr-bench.mjs [--save dir]` prints character error rate, identifiers read exactly,
and seconds per page for fictional Hebrew and English pages under four conditions (clean 300 DPI, 200 DPI scan,
fax, phone photo), with and without the clean-up step. On 2026-11-06 (Hebrew + English, with clean-up): all
47/47 identifiers read exactly in every condition, 2–3% character error on Hebrew, under 1% on English, about
1 second per page. Without clean-up the phone photo dropped to 17% error and lost names. Float `tessdata_best`
models don't run in the wasm build; English-only mode fails on Hebrew (82% error).

`dist-test/` also matches `http://localhost`, for the mock page; `dist/` matches claude.ai only.

**Manual check on live claude.ai** before each release (selectors drift):
1. A new chat: type an instruction in Claude's box, declare a person, Put into Claude: the article lands after the instruction, nothing is sent.
2. Send in Claude: the URL becomes `/chat/<uuid>`; reopen the panel and the case is still there.
3. Ask Claude for a rewrite, then Bring back the last reply: real names, headings and lists intact.
4. Copy an artifact from Claude into the paste box: restored.
