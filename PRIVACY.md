# Smart Scrubber privacy policy

*Last updated: 6 November 2026. Publisher: SmartPsyc ([smartpsyc.com](https://smartpsyc.com)).*

Smart Scrubber is a Chrome extension that replaces names and other identifiers in a text with stand-ins before the
text is put into claude.ai, and puts the real names back into Claude's reply when you ask.

## What it does with your data

- **Everything happens in your browser.** The text you paste or the file you open (Word, PDF, scan, photo) is read,
  anonymized and restored inside the extension's side panel. Scans and photos are read by an OCR engine that is
  bundled in the extension.
- **Nothing is sent to us or to anyone else.** The extension has no server. Its pages are locked by a content
  security policy that blocks every network request (`connect-src 'none'`), and it loads no code, fonts or data
  from the internet. It has no analytics, no tracking and no ads.
- **What reaches claude.ai is only the anonymized text**, and only when you click *Put into Claude* or paste it
  yourself. The extension never clicks Send. What you then do in claude.ai is governed by Anthropic's own terms and
  privacy policy.
- **The key (real name ↔ stand-in) stays on your computer**, encrypted with AES-GCM in `chrome.storage.local`. The
  encryption key is a non-extractable browser key kept in the extension's IndexedDB. Keys are deleted automatically
  after 30 days (you can change this), or at once with *Delete this case*. Uninstalling the extension deletes them all.
- **Reading Claude's reply** happens only when you click *Restore real names*: the extension reads the last reply on
  the claude.ai page you have open and restores the names in its own panel.

## Permissions

- `sidePanel`: to show the panel beside claude.ai.
- `storage`: to keep the encrypted keys and your settings on this computer.
- Access to `https://claude.ai/*`: to put the anonymized text into Claude's message box and, on request, read the last
  reply. It runs on no other site.

## Not a guarantee

Automatic detection can miss an identifier, and OCR can misread one. Check the anonymized text before you send it.
You remain responsible for what you share.

## Contact

Questions: through [smartpsyc.com](https://smartpsyc.com), or an issue at
[github.com/Smartpsyc/smart-scrubber](https://github.com/Smartpsyc/smart-scrubber). The source code is public
(Apache-2.0), so every statement here can be checked.

Smart Scrubber is not made by, affiliated with, or endorsed by Anthropic. Claude is a trademark of Anthropic.
