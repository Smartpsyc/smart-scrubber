import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createCase, scrub, detectPatterns, isValidIsraeliId } from '../src/index.js';

test('Israeli ID checksum', () => {
  assert.ok(isValidIsraeliId('000000018'));
  assert.ok(isValidIsraeliId('123456782'));
  assert.ok(!isValidIsraeliId('123456789'));
  assert.ok(!isValidIsraeliId('000000000'));
});

test('ordinary 9-digit numbers are left alone; valid IDs are redacted', () => {
  const k = createCase({ seed: 'x' });
  assert.equal(scrub('מספר תיק 123456789', k).text, 'מספר תיק 123456789');
  assert.equal(scrub('ת.ז. 123456782', k).text, 'ת.ז. [ת.ז. 1]');
  assert.equal(scrub('ID: 12345678-2', k).text, 'ID: [ID 1]');
});

test('short IDs need an explicit cue', () => {
  const k = createCase({ seed: 'x' });
  assert.equal(scrub('ת"ז 18', k).text, 'ת"ז 18'); // too short to be an ID
  assert.equal(scrub('ת"ז 30000004', k).text, 'ת"ז [ת.ז. 1]');
  assert.equal(scrub('ניקוד 30000004', k).text, 'ניקוד 30000004');
});

test('phones in common formats, same number → same token', () => {
  const k = createCase({ seed: 'x' });
  const r = scrub('טלפונים: 054-123-4567, 0541234567, +972 54 123 4567, (03) 6123456, 03-6123456', k);
  assert.equal(r.text, 'טלפונים: [טלפון 1], [טלפון 1], [טלפון 1], [טלפון 2], [טלפון 2]');
});

test('email, URL (trailing punctuation kept), addresses', () => {
  const k = createCase({ seed: 'x' });
  assert.equal(scrub('Mail a.b@example.co.il now.', k).text, 'Mail [EMAIL 1] now.');
  assert.equal(scrub('See https://x.org/p?q=1.', k).text, 'See [URL 1].');
  assert.equal(scrub('גרים ברחוב הרצל 12 בעיר.', k).text, 'גרים ב[כתובת 1] בעיר.');
  assert.equal(scrub('Lives at 42 Maple Grove Road.', k).text, 'Lives at [ADDRESS 1].');
});

test('detectPatterns finds nothing in plain clinical prose', () => {
  const t = 'הילד קיבל ציון 85 במבחן, 7/10 בשאלון, וענה על 12 מתוך 20 פריטים ב-2023.';
  assert.deepEqual(detectPatterns(t), []);
});
