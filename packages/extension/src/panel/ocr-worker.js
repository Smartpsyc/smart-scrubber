// The OCR worker. Tesseract's own worker script asks fetch() for its language
// models; here fetch() can only hand back the models bundled in this extension
// and refuses everything else. (The panel's CSP blocks all network access too.)
'use strict';

const BASE = '../vendor/tesseract/';

self.fetch = async (url) => {
  // tesseract.js resolves langPath 'local' against the panel page's own URL.
  const m = /^chrome-extension:\/\/[a-p]{32}\/panel\/local\/(heb|eng)\.traineddata\.gz$/.exec(String(url));
  if (!m) throw new Error(`OCR worker: no network (${String(url).slice(0, 60)})`);
  if (!self.TESS_LANG || !self.TESS_LANG[m[1]]) importScripts(`${BASE}lang-${m[1]}.js`);
  const bin = atob(self.TESS_LANG[m[1]]);
  delete self.TESS_LANG[m[1]];
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new Response(bytes);
};

importScripts(`${BASE}worker.min.js`);
