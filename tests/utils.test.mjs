import test from 'node:test';
import assert from 'node:assert/strict';
import { today, monthNow, uid, safeCsvCell } from '../src/core/utils.js';

test('today a monthNow používají místní kalendářní datum', () => {
  const d = new Date(2026, 0, 2, 0, 15, 0);
  assert.equal(today(d), '2026-01-02');
  assert.equal(monthNow(d), '2026-01');
});

test('uid vytváří bezpečný identifikátor a CSV chrání vzorce', () => {
  assert.match(uid('note'), /^note_[A-Za-z0-9]+$/);
  assert.equal(safeCsvCell('=2+2'), "'=2+2");
  assert.equal(safeCsvCell('běžný text'), 'běžný text');
});
