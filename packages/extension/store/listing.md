# Chrome Web Store listing: Smart Scrubber

Copy these into the developer dashboard (chrome.google.com/webstore/devconsole). Files:
`release/smart-scrubber-v<version>.zip` (`npm run package`), and the images in this folder (`npm run store-assets`).

## Package
- Upload: `release/smart-scrubber-v0.4.0.zip`

## Store listing tab
- **Name** (from the manifest): Smart Scrubber
- **Summary** (from the manifest, ≤132 chars): Swaps names and identifiers for stand-ins before your text reaches claude.ai, and restores them only when you ask. Runs locally.
- **Category:** Productivity → Tools (or Workflow & Planning)
- **Language:** English. Add Hebrew as a second listing language with the Hebrew text below.
- **Store icon:** `src/icons/icon-128.png`
- **Screenshots (1280×800):** `screenshot-1-paste.png`, `screenshot-2-check.png`, `screenshot-3-restore.png`
- **Small promo tile (440×280):** `promo-small.png`
- **Official URL / Homepage:** https://smartpsyc.com
- **Support URL:** https://github.com/Smartpsyc/smart-scrubber/issues

### Description (English)

Work with Claude on clinical reports, school letters and case notes without sending real names.

Smart Scrubber sits in Chrome's side panel next to claude.ai:

1. Anonymize and put into Claude. Paste the text, or drop a Word file, a PDF, a scan or a photo of a page. Names, ID numbers, phone numbers, emails, dates, towns and schools are swapped for realistic stand-ins (same gender, so Hebrew grammar stays right), and the anonymized text goes into Claude's message box. Add your request and send it yourself: the extension never clicks Send.
2. Bring back the final version. When Claude is done, one click puts the real names back into its reply, in the panel, ready to copy or save.

Built for Hebrew and English, right-to-left included.

Private by design:
• Everything runs in your browser. There is no server, no account, no analytics and no tracking.
• Scans and photos are read with an OCR engine bundled in the extension. Nothing is downloaded or uploaded.
• The key (real name ↔ stand-in) is encrypted and stays on your computer; it expires after 30 days.
• Open source (Apache-2.0): github.com/Smartpsyc/smart-scrubber

Automatic detection can miss things and scans can be misread, so the panel shows exactly what Claude will get before you send.

Not made by, affiliated with or endorsed by Anthropic. Claude is a trademark of Anthropic.

Built by the SmartPsyc team · Custom software for automation and psychological practice, for clinics, schools and organisations. https://smartpsyc.com

### Description (Hebrew)

עבודה עם Claude על דוחות קליניים, מכתבים לבית הספר ותיעוד מפגשים, בלי לשלוח שמות אמיתיים.

Smart Scrubber נפתח בחלונית הצד של Chrome, ליד claude.ai:

1. הסוואה והכנסה ל-Claude. מדביקים את הטקסט, או גוררים קובץ Word, ‏PDF, סריקה או צילום של דף. שמות, מספרי זהות, טלפונים, מיילים, תאריכים, יישובים ובתי ספר מוחלפים בחלופות מציאותיות (באותו מגדר, כך שהעברית נשארת תקינה), והטקסט המוסווה נכנס לתיבת ההודעה של Claude. מוסיפים בקשה ושולחים בעצמכם: התוסף אף פעם לא לוחץ על שליחה.
2. החזרת הגרסה הסופית. כש-Claude מסיים, לחיצה אחת מחזירה את השמות האמיתיים לתשובה שלו, בתוך החלונית, מוכנה להעתקה או לשמירה.

בנוי לעברית ולאנגלית, כולל כתיבה מימין לשמאל.

פרטיות כבר בתכנון:
• הכול רץ בדפדפן. אין שרת, אין חשבון, אין אנליטיקה ואין מעקב.
• סריקות וצילומים נקראים במנוע OCR שארוז בתוך התוסף. שום דבר לא יורד ולא עולה לרשת.
• המפתח (שם אמיתי ↔ חלופה) מוצפן ונשאר במחשב שלכם, ונמחק אחרי 30 יום.
• קוד פתוח (Apache-2.0): github.com/Smartpsyc/smart-scrubber

זיהוי אוטומטי יכול לפספס וסריקה יכולה להיקרא לא נכון, לכן החלונית מראה בדיוק מה Claude יקבל לפני השליחה.

התוסף אינו של Anthropic, ואינו קשור אליה או מאושר על ידה. Claude הוא סימן מסחרי של Anthropic.

נבנה על ידי צוות SmartPsyc · תוכנות בהתאמה אישית לאוטומציה ולעבודה פסיכולוגית, לקליניקות, לבתי ספר ולארגונים. https://smartpsyc.com

## Privacy practices tab

- **Single purpose:** Anonymize text locally before the user puts it into claude.ai, and restore the real names in Claude's reply on request.
- **Permission justifications:**
  - `sidePanel`: the extension's whole interface is a side panel shown next to claude.ai.
  - `storage`: keeps the user's settings and the encrypted name ↔ stand-in key for each conversation on this computer.
  - Host permission `https://claude.ai/*`: a content script puts the anonymized text into Claude's message box when the user clicks *Put into Claude*, and reads Claude's last reply when the user clicks *Restore real names*. No other site.
- **Remote code:** No, I am not using remote code. All code, including pdf.js, mammoth and the Tesseract OCR engine (wasm) and its language data, is in the package.
- **Data usage:** The extension processes personally identifiable and health information that the user pastes, but only on the user's device: nothing is transmitted to the developer or any third party. Google's user-data FAQ treats data handled only on the device as not collected; if the form still asks, tick *Personally identifiable information* and *Health information* and say they never leave the device. Then tick all three certifications (not sold, not used for unrelated purposes, not used for creditworthiness).
- **Privacy policy URL:** https://github.com/Smartpsyc/smart-scrubber/blob/main/PRIVACY.md

## Distribution tab
- **Visibility:** *Unlisted* to share by link with colleagues first; *Public* when ready.
- **Regions:** all (or Israel only, to start).
