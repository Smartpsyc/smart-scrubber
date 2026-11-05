import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createCase, scrub, restore, parseDates, shiftValue } from '../src/index.js';

const kaseWith = (days) => createCase({ seed: 'd', dateOffsetDays: days });
const dow = (y, m, d) => new Date(Date.UTC(y, m - 1, d)).getUTCDay();

test('default offset is whole weeks, at least 5, non-zero', () => {
  for (let i = 0; i < 200; i++) {
    const k = createCase({ seed: 'seed' + i });
    assert.equal(Math.abs(k.dateOffsetDays % 7), 0);
    assert.ok(Math.abs(k.dateOffsetDays) >= 35 && Math.abs(k.dateOffsetDays) <= 52 * 7);
  }
});

test('weekday is preserved', () => {
  const v = { k: 'ymd', y: 2024, m: 3, d: 12 };
  for (const days of [-364, -35, 35, 147, 364]) {
    const s = shiftValue(v, days);
    assert.equal(dow(s.y, s.m, s.d), dow(2024, 3, 12));
  }
});

test('formats round-trip exactly', () => {
  const text = [
    '12/03/2024', '5/3/2024', '05.03.24', '12-03-2024', '2024-03-12', '03/2024',
    '12 במרץ 2024', '12 מרס 2024', '12 למרץ', 'בינואר 2025', 'March 12, 2024', 'Mar. 12th',
    '12 March 2024', '12th of March', 'September 2024', 'Sept 3, 2024', '29/02/2024', '3/25/2024',
  ].join(' | ');
  const k = kaseWith(-147);
  const r = scrub(text, k);
  for (const piece of text.split(' | ')) {
    assert.ok(!r.text.split(' | ').includes(piece), `${piece} was not shifted: ${r.text}`);
  }
  assert.equal(restore(r.text, r.case).text, text);
});

test('scores, ranges and bare years are not dates', () => {
  const text = 'ציון 7/10, 12/20 נקודות, טווח 2019-2021, בשנת 2015, גרסה 1.2.3, IQ 85.';
  const r = scrub(text, kaseWith(70));
  assert.equal(r.text, text);
});

test('2-digit years and month/year shifts', () => {
  const r = scrub('3.11.24 ו-11/2024', kaseWith(-70));
  assert.equal(r.text, '25.8.24 ו-09/2024'.replace('09', '9'));
});

test('MDY is detected when the day is > 12', () => {
  const d = parseDates('3/25/2024')[0];
  assert.deepEqual(d.value, { k: 'ymd', y: 2024, m: 3, d: 25 });
  assert.equal(d.fmt.order, 'MDY');
});

test('lowercase month words are not dates', () => {
  assert.equal(parseDates('you may 5 times, march 3 steps').length, 0);
});
