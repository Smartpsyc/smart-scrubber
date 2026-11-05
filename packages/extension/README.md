# Smart Scrubber: Chrome extension

A side panel for claude.ai. You type or paste real case text into the panel and check the highlighted preview.
Clicking **Send to Claude** puts only the scrubbed version into Claude's message box and sends it. Real names come
back only when you ask, either with **Bring back the last reply** or by pasting what you copied from Claude. They appear in
the panel, never on the claude.ai page.

**Risk reduction, not anonymization or compliance.** See the threat model in [`../scrub-core/README.md`](../scrub-core/README.md#threat-model).

## Install (developer mode)

```
cd packages/extension
npm run build            # → dist/
```

Open `chrome://extensions`, turn on **Developer mode**, click **Load unpacked** and choose `packages/extension/dist`.
Pin the extension, open claude.ai, then click the toolbar icon to open the panel.

## How it works

| Piece | File | Notes |
|-------|------|-------|
| Side panel | `src/panel/` | Case fields (manual), suggestion chips (auto), preview, outgoing text, key, restore. English + Hebrew (RTL). |
| Engine | `vendor/scrub-core/` (copied in at build) | Same code as `packages/scrub-core`, loaded as native ES modules: no bundler. |
| Case store | `src/panel/store.js` | AES-GCM-256. The key is a **non-extractable** `CryptoKey` in IndexedDB; ciphertext in `chrome.storage.local`, keyed by Claude conversation id. Cases expire after 30 days (configurable). |
| claude.ai adapter | `src/content/claude-adapter.js` | **All claude.ai selectors live here.** Inserts scrubbed text (synthetic paste), clicks Send, reads the last finished reply on request (converted back to Markdown). |
| Service worker | `src/background.js` | Only opens the panel from the toolbar. Never sees case text. |

Guarantees you can check in the code:
- The panel's CSP has `connect-src 'none'`: extension pages can't make network requests.
- The only permissions are `sidePanel`, `storage`, and host access to `https://claude.ai/*`.
- The content script receives only scrubbed text, and never writes real names into the page.

**Fails closed.** If Claude's message box can't be found, Send is disabled ("Claude's page changed. The scrubber is paused").
Sending is also refused when:
- Claude's box already has text in it (that text was never scrubbed),
- files are attached in Claude,
- the inserted text doesn't match exactly,
- Send never becomes clickable.

If any real identifier would remain in the outgoing text, Send stays blocked.

New chats: the case is a draft until the first send. After that it moves to the conversation's id (`/chat/<uuid>`)
and reopens automatically whenever you come back to that conversation.

## Not in this version yet

- **Leak guard** (Phase 3): a page-world `fetch` wrapper that blocks any request carrying a declared identifier,
  including text typed straight into claude.ai. Until then, **anything typed directly into claude.ai is not scrubbed.**
- Files, scanned PDFs and photos (Phase 4).

## Tests

```
npm test                 # builds dist-test/ and runs the end-to-end tests
```

The tests load the unpacked extension in Chromium (Playwright) and drive a **mock claude.ai page**
(`test/mock/claude-mock.html`). The mock copies the real page's structure as recorded on 2026-11-05. The tests cover:
- scrubbing before send,
- the encrypted store (no real name anywhere in `chrome.storage`),
- conversation binding,
- restoring through the button and the paste box (exact round trip),
- the fail-closed states,
- auto-mode suggestions, tag-a-word, and the Hebrew RTL UI.

`dist-test/` also matches `http://localhost`, for the mock page; `dist/` matches claude.ai only.

**Manual check on live claude.ai** before each release (selectors drift):
1. A new chat: declare a person, send a note, then confirm Claude's message shows only stand-ins.
2. The URL becomes `/chat/<uuid>`; reopen the panel and the case is still there.
3. Bring back the last reply: real names, headings and lists intact.
4. Type something into Claude's box, then Send from the panel: refused.
