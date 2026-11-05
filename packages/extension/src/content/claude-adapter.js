// claude.ai adapter (content script, isolated world).
// ALL claude.ai selectors live in this file. Selectors were captured in the
// Phase 0 spike (2026-11-05); see docs/claude-scrubber-extension-plan.md.
//
// This script only ever receives text that the panel has already scrubbed.
// It never restores anything into the page: "Bring back from Claude" reads the
// last reply once and hands it to the panel.

(() => {
  if (window.__scrubberAdapter) return;
  window.__scrubberAdapter = true;

  const ADAPTER = 'claude-2026-11-05';
  const SEL = {
    composer: '[data-testid="chat-input"][contenteditable="true"]',
    staticComposer: '[data-testid="static-composer-input"]',
    send: '[data-testid="chat-input-send"]',
    attachment: '[data-testid="file-thumbnail"]',
    row: '[data-testid="transcript-row"]',
    user: '[data-testid="user-message"]',
    assistant: '[data-testid="assistant-message"]',
    markdown: '.standard-markdown',
    actions: '[data-testid="message-actions"]',
  };

  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const squash = (s) => String(s || '').replace(/\s+/g, '');
  const conversationId = () => (location.pathname.match(/\/chat\/([0-9a-f]{8}-[0-9a-f-]{27})/i) || [])[1] || null;
  const composer = () => document.querySelector(SEL.composer);
  const sendButton = () => document.querySelector(SEL.send);

  async function waitFor(fn, ms, step = 100) {
    const end = Date.now() + ms;
    for (;;) {
      const v = fn();
      if (v) return v;
      if (Date.now() > end) return null;
      await sleep(step);
    }
  }

  function health() {
    const base = { adapter: ADAPTER, conversationId: conversationId(), title: document.title };
    if (composer()) return { ok: true, ...base };
    return { ok: false, reason: document.querySelector(SEL.staticComposer) ? 'loading' : 'no-composer', ...base };
  }

  function clearComposer(el) {
    el.focus();
    document.execCommand('selectAll');
    document.execCommand('delete');
  }

  async function insertAndSend(text) {
    const el = composer();
    if (!el) return { ok: false, reason: 'no-composer' };
    // Whatever is already in the box was typed straight into claude.ai and was
    // never scrubbed. Refuse rather than send it along.
    if (squash(el.innerText)) return { ok: false, reason: 'composer-not-empty' };
    if (document.querySelector(SEL.attachment)) return { ok: false, reason: 'attachments-present' };

    el.focus();
    const dt = new DataTransfer();
    dt.setData('text/plain', text);
    el.dispatchEvent(new ClipboardEvent('paste', { clipboardData: dt, bubbles: true, cancelable: true }));
    let landed = await waitFor(() => squash(el.innerText) === squash(text), 1500);
    if (!landed) {
      clearComposer(el);
      document.execCommand('insertText', false, text);
      landed = await waitFor(() => squash(el.innerText) === squash(text), 1500);
    }
    if (!landed) {
      clearComposer(el);
      return { ok: false, reason: 'insert-mismatch' };
    }

    const btn = await waitFor(() => { const b = sendButton(); return b && !b.disabled ? b : null; }, 3000);
    if (!btn) {
      clearComposer(el);
      return { ok: false, reason: 'no-send' };
    }
    const before = location.pathname;
    btn.click();
    const sent = await waitFor(() => location.pathname !== before || !squash(composer()?.innerText), 10000);
    if (!sent) return { ok: false, reason: 'send-unconfirmed' };
    const id = await waitFor(conversationId, 5000);
    return { ok: true, conversationId: id };
  }

  // ---------- reading a reply (on click only) ----------

  const inline = (node) => inlineNodes(node.childNodes);

  function inlineNodes(nodes) {
    let s = '';
    for (const n of nodes) {
      if (n.nodeType === Node.TEXT_NODE) { s += n.nodeValue; continue; }
      if (n.nodeType !== Node.ELEMENT_NODE) continue;
      if (n.classList.contains('sr-only')) continue;
      const t = n.tagName;
      if (t === 'BR') s += '\n';
      else if (t === 'STRONG' || t === 'B') s += `**${inline(n)}**`;
      else if (t === 'EM' || t === 'I') s += `*${inline(n)}*`;
      else if (t === 'CODE') s += '`' + n.textContent + '`';
      else if (t === 'A') s += `[${inline(n)}](${n.getAttribute('href') || ''})`;
      else if (t === 'BUTTON' || t === 'SVG' || t === 'svg') continue;
      else s += inline(n);
    }
    return s;
  }

  function block(node, depth = 0) {
    const out = [];
    for (const n of node.children) {
      if (n.classList.contains('sr-only')) continue;
      const t = n.tagName;
      if (/^H[1-6]$/.test(t)) out.push('#'.repeat(Number(t[1])) + ' ' + inline(n).trim());
      else if (t === 'P') out.push(inline(n).trim());
      else if (t === 'UL' || t === 'OL') out.push(list(n, depth));
      else if (t === 'PRE') out.push('```\n' + n.textContent.replace(/\n$/, '') + '\n```');
      else if (t === 'BLOCKQUOTE') out.push(block(n, depth).split('\n').map((l) => '> ' + l).join('\n'));
      else if (t === 'HR') out.push('---');
      else if (t === 'TABLE') out.push(table(n));
      else if (t === 'BUTTON') continue;
      else if (n.children.length) out.push(block(n, depth));
      else if (n.textContent.trim()) out.push(inline(n).trim());
    }
    return out.filter(Boolean).join('\n\n');
  }

  function list(n, depth) {
    const ordered = n.tagName === 'OL';
    let i = Number(n.getAttribute('start') || 1);
    return [...n.children].filter((li) => li.tagName === 'LI').map((li) => {
      const pad = '  '.repeat(depth);
      const marker = ordered ? `${i++}.` : '-';
      const own = [];
      const nested = [];
      let run = [];
      const flush = () => { if (run.length) own.push(inlineNodes(run)); run = []; };
      for (const c of li.childNodes) {
        const isEl = c.nodeType === Node.ELEMENT_NODE;
        if (isEl && (c.tagName === 'UL' || c.tagName === 'OL')) { flush(); nested.push(list(c, depth + 1)); }
        else if (isEl && c.tagName === 'P') { flush(); own.push(inline(c).trim()); }
        else run.push(c);
      }
      flush();
      return [`${pad}${marker} ${own.join(' ').replace(/\s+/g, ' ').trim()}`, ...nested].join('\n');
    }).join('\n');
  }

  function table(t) {
    const rows = [...t.querySelectorAll('tr')].map((tr) => [...tr.children].map((c) => inline(c).trim().replace(/\|/g, '\\|')));
    if (!rows.length) return '';
    const head = `| ${rows[0].join(' | ')} |`;
    const sep = `| ${rows[0].map(() => '---').join(' | ')} |`;
    return [head, sep, ...rows.slice(1).map((r) => `| ${r.join(' | ')} |`)].join('\n');
  }

  function readLastAssistant() {
    const rows = [...document.querySelectorAll(SEL.row)];
    if (!rows.length) return { ok: false, reason: 'no-reply' };
    const last = rows[rows.length - 1];
    if (!last.querySelector(SEL.assistant)) {
      return { ok: false, reason: last.querySelector(SEL.user) ? 'still-writing' : 'no-reply' };
    }
    const streaming = last.getAttribute('data-perf-row-streaming') === 'true' || !last.querySelector(SEL.actions);
    if (streaming) return { ok: false, reason: 'still-writing' };
    const blocks = [...last.querySelectorAll(`${SEL.assistant} ${SEL.markdown}`)];
    if (!blocks.length) return { ok: false, reason: 'no-reply-text' };
    const text = blocks.map((b) => block(b)).join('\n\n').replace(/\n{3,}/g, '\n\n').trim();
    return { ok: true, text, conversationId: conversationId() };
  }

  // ---------- messaging ----------

  const handlers = {
    health: async () => health(),
    send: async (msg) => insertAndSend(String(msg.text || '')),
    readLast: async () => readLastAssistant(),
  };

  chrome.runtime.onMessage.addListener((msg, _sender, reply) => {
    if (!msg || msg.ns !== 'scrubber' || !handlers[msg.cmd]) return false;
    handlers[msg.cmd](msg).then(reply, (e) => reply({ ok: false, reason: 'error', detail: String(e && e.message || e) }));
    return true;
  });

  // Tell open panels when the conversation changes (new chat gets its id, or
  // the clinician switches chats), so they can switch cases.
  let lastPath = location.pathname;
  const timer = setInterval(() => {
    if (location.pathname === lastPath) return;
    lastPath = location.pathname;
    try {
      chrome.runtime.sendMessage({ ns: 'scrubber', event: 'conversation', conversationId: conversationId() }).catch(() => {});
    } catch {
      clearInterval(timer); // extension reloaded; this copy is orphaned
    }
  }, 700);
})();
