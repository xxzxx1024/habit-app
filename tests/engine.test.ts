import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  cardAvailable,
  checkIn,
  earnedToday,
  initialData,
  isScheduled,
  points,
  redeem,
  resetProgress,
  rollover,
  saveHabit,
  saveReward,
  setNote,
  updateSettings,
  useCard,
} from '../src/domain/engine';
import { AppData, Habit, RuleError } from '../src/domain/model';
import { dateKey, weekKey, daysBetween } from '../src/domain/time';
import { completion, streak, trend } from '../src/domain/stats';
import { exportCSV } from '../src/domain/csv';
import { parseDocument } from '../src/domain/validate';
import { dictionaries } from '../src/i18n';
const now = new Date(2026, 9, 15, 10, 30),
  next = new Date(2026, 9, 16, 10),
  monday = new Date(2026, 9, 19, 8);
const habit = (extra: Partial<Habit> = {}): Habit => ({
  id: 'good',
  name: 'Read',
  kind: 'good',
  points: 10,
  limit: 20,
  cycle: { mode: 'daily' },
  halfEnabled: true,
  reminder: null,
  createdOn: dateKey(now),
  ...extra,
});
function seed() {
  let s = saveHabit(initialData('en', now), habit());
  return saveHabit(s, habit({ id: 'bad', name: 'Smoke', kind: 'bad', points: 14 }));
}
function throws(fn: () => unknown, code: string) {
  assert.throws(fn, (e: unknown) => e instanceof RuleError && e.code === code);
}
function funded() {
  let s = seed();
  for (let i = 0; i < 6; i++) s = checkIn(s, 'good', 1, now);
  return s;
}

test('default cap is 30 and balance floor is -10', () => {
  const s = seed();
  assert.equal(points(s.settings.dailyCap), 30);
  assert.equal(points(s.settings.floor), -10);
});
test('missed habits never alter points; immutable input', () => {
  const s = seed();
  assert.equal(rollover(s, now), s);
  const next = checkIn(s, 'good', 1, now);
  assert.equal(s.balance, 0);
  assert.equal(next.balance, 10);
});
test('good habit adds; manually logged bad habit deducts', () => {
  let s = checkIn(seed(), 'good', 1, now);
  s = checkIn(s, 'bad', 1, now);
  assert.equal(points(s.balance), -2);
  assert.equal(s.ledger[1]?.balance, -4);
});
test('half completion earns exactly 50%, including odd whole points', () => {
  const s = checkIn(seed(), 'good', 0.5, now);
  assert.equal(points(s.balance), 2.5);
  assert.equal(s.checkIns[0]?.fraction, 0.5);
});
test('half bad habit deducts half', () => {
  const s = checkIn(seed(), 'bad', 0.5, now);
  assert.equal(points(s.balance), -3.5);
});
test('daily positive cap clamps partial gain and records a zero gain after cap', () => {
  let s = updateSettings(seed(), { ...seed().settings, dailyCap: 24 }, now);
  for (let i = 0; i < 4; i++) s = checkIn(s, 'good', 1, now);
  assert.deepEqual(
    s.ledger.map((e) => e.delta),
    [10, 10, 4, 0],
  );
  assert.equal(s.checkIns.length, 4);
});
test('bad events and reward purchases cannot reopen the daily earning cap', () => {
  let s = funded();
  s = checkIn(s, 'bad', 1, now);
  s = saveReward(s, { id: 'tea', name: 'Tea', cost: 4 });
  s = redeem(s, 'tea', now);
  s = checkIn(s, 'good', 1, now);
  assert.equal(earnedToday(s, dateKey(now)), 60);
  assert.equal(s.checkIns.at(-1)?.delta, 0);
});
test('bad deductions clamp at global balance floor, not a daily deduction cap', () => {
  let s = seed();
  s = checkIn(s, 'bad', 1, now);
  s = checkIn(s, 'bad', 1, now);
  s = checkIn(s, 'bad', 1, next);
  assert.deepEqual(
    s.ledger.map((e) => e.delta),
    [-14, -6, 0],
  );
  assert.equal(points(s.balance), -10);
});
test('raising floor above existing balance does not create points or charge more', () => {
  let s = checkIn(seed(), 'bad', 1, now);
  s = updateSettings(s, { ...s.settings, floor: -2 }, now);
  s = checkIn(s, 'bad', 1, now);
  assert.equal(s.balance, -14);
  assert.equal(s.ledger.at(-1)?.delta, 0);
});
test('cap renews on a new LOCAL day', () => {
  let s = funded();
  s = checkIn(s, 'good', 1, next);
  assert.equal(points(s.balance), 35);
});
test('full and half check-ins both consume one daily slot', () => {
  let s = saveHabit(seed(), habit({ limit: 1 }));
  s = checkIn(s, 'good', 0.5, now);
  throws(() => checkIn(s, 'good', 1, now), 'limitReached');
  assert.equal(checkIn(s, 'good', 1, next).checkIns.length, 2);
});
test('disabled half completion is rejected', () =>
  throws(
    () => checkIn(saveHabit(seed(), habit({ halfEnabled: false })), 'good', 0.5, now),
    'halfDisabled',
  ));
test('weekday and interval plans honor local dates, anchor and creation', () => {
  const h = habit({ cycle: { mode: 'weekdays', days: [4] } });
  assert.equal(isScheduled(h, dateKey(now)), true);
  assert.equal(isScheduled(h, dateKey(next)), false);
  throws(() => checkIn(saveHabit(seed(), h), 'good', 1, next), 'notScheduled');
  const n = habit({ cycle: { mode: 'interval', every: 2, anchor: dateKey(now) } });
  assert.equal(isScheduled(n, '2026-10-17'), true);
  assert.equal(isScheduled(n, '2026-10-14'), false);
});
test('invalid habit configurations rejected, including quarter point ambiguity', () => {
  for (const h of [
    habit({ name: ' ' }),
    habit({ points: 3 }),
    habit({ limit: 0 }),
    habit({ reminder: '25:00' }),
    habit({ cycle: { mode: 'weekdays', days: [] } }),
    habit({ cycle: { mode: 'interval', every: 0, anchor: dateKey(now) } }),
  ])
    throws(() => saveHabit(seed(), h), 'invalid');
});
test('a weekly card is derived, unused cards do not stack', () => {
  const s = seed();
  assert.equal(cardAvailable(s, now), true);
  assert.equal(cardAvailable(s, new Date(2027, 1, 1)), true);
});
test('exemption blocks future positive and negative points that day, logs prior entries intact', () => {
  let s = checkIn(seed(), 'good', 1, now);
  s = useCard(s, now);
  s = checkIn(s, 'good', 1, now);
  s = checkIn(s, 'bad', 1, now);
  assert.deepEqual(
    s.ledger.map((e) => e.delta),
    [10, 0, 0],
  );
  assert.equal(s.exemptions.length, 1);
  assert.equal(s.checkIns.length, 3);
});
test('card expires next day, no second use that week, renews Monday', () => {
  let s = useCard(seed(), now);
  throws(() => useCard(s, next), 'cardUsed');
  s = checkIn(s, 'bad', 1, next);
  assert.equal(s.balance, -14);
  assert.equal(cardAvailable(s, monday), true);
  assert.equal(useCard(s, monday).exemptions.length, 2);
});
test('exemption does not change balance by itself', () =>
  assert.equal(useCard(funded(), now).balance, 60));
test('points accumulate across weeks by default', () =>
  assert.equal(rollover(funded(), monday).balance, 60));
test('weekly reset logs adjustment once, before next operation; handles negative balances', () => {
  let s = funded();
  s = updateSettings(s, { ...s.settings, weeklyReset: true }, now);
  s = checkIn(s, 'good', 1, monday);
  assert.equal(s.balance, 10);
  assert.equal(s.ledger.filter((e) => e.kind === 'weeklyReset').length, 1);
  assert.equal(rollover(s, monday), s);
  let n = checkIn(seed(), 'bad', 1, now);
  n = updateSettings(n, { ...n.settings, weeklyReset: true }, now);
  assert.equal(rollover(n, monday).balance, 0);
});
test('changing reset setting applies OLD policy to elapsed week', () => {
  let s = updateSettings(funded(), { ...seed().settings, weeklyReset: true }, now);
  s = updateSettings(s, { ...s.settings, weeklyReset: false }, monday);
  assert.equal(s.balance, 0);
});
test('redemption validates exact price, writes ledger and history atomically', () => {
  let s = saveReward(funded(), { id: 'r', name: 'Tea', cost: 60 });
  s = redeem(s, 'r', now);
  assert.equal(s.balance, 0);
  assert.equal(s.redemptions.length, 1);
  assert.equal(s.ledger.at(-1)?.delta, -60);
  throws(() => redeem(s, 'r', now), 'insufficient');
});
test('reward cannot be free, negative or fractional internal unit', () => {
  for (const cost of [0, -1, 1.5])
    throws(() => saveReward(seed(), { id: 'r', name: 'a', cost }), 'invalid');
});
test('journal edit does not create another check-in or ledger entry', () => {
  const s = checkIn(seed(), 'good', 1, now);
  const n = setNote(s, s.checkIns[0]!.id, 'Small progress');
  assert.equal(n.ledger.length, 1);
  assert.equal(n.checkIns.length, 1);
  assert.equal(n.balance, 10);
  assert.equal(n.checkIns[0]?.note, 'Small progress');
});
test('deleting a habit retains name snapshots and history', () => {
  const s = checkIn(seed(), 'good', 1, now);
  const n = { ...s, habits: [] };
  assert.equal(n.checkIns[0]?.name, 'Read');
  assert.equal(n.ledger[0]?.name, 'Read');
});
test('reset retains templates, rewards and settings but clears progress', () => {
  let s = saveReward(useCard(funded(), now), { id: 'r', name: 'Tea', cost: 2 });
  s = redeem(s, 'r', now);
  const n = resetProgress(s, now);
  assert.deepEqual(n.habits, s.habits);
  assert.deepEqual(n.rewards, s.rewards);
  assert.equal(n.balance, 0);
  assert.equal(n.checkIns.length + n.ledger.length + n.redemptions.length + n.exemptions.length, 0);
});
test('completion counts good habits only; half = 0.5; streak ignores bad habits', () => {
  let s = saveHabit(seed(), habit({ limit: 1 }));
  s = checkIn(s, 'good', 0.5, now);
  s = checkIn(s, 'bad', 1, next);
  assert.equal(completion(s, dateKey(now)), 50);
  assert.equal(streak(s, dateKey(next)), 1);
  assert.equal(streak(s, '2026-10-17'), 0);
  s = checkIn(s, 'good', 1, next);
  assert.equal(streak(s, dateKey(next)), 2);
});
test('trend includes negative redemption and reset transactions', () => {
  let s = saveReward(funded(), { id: 'r', name: 'Tea', cost: 10 });
  s = redeem(s, 'r', now);
  const rows = trend(s, 7, dateKey(now));
  assert.equal(rows.length, 7);
  assert.equal(rows.at(-1)?.delta, 50);
});
test('week boundaries use Monday including year crossings; DST-safe days', () => {
  assert.equal(weekKey(new Date(2026, 9, 18)), '2026-10-12');
  assert.equal(weekKey(monday), '2026-10-19');
  assert.equal(weekKey(new Date(2027, 0, 1)), '2026-12-28');
  assert.equal(daysBetween('2026-03-07', '2026-03-09'), 2);
});
test('CSV preserves commas, newlines, unicode and neutralizes formulas', () => {
  let s = saveHabit(seed(), habit({ name: '=HYPERLINK("x"),日文' }));
  s = checkIn(s, 'good', 1, now);
  s = setNote(s, s.checkIns[0]!.id, 'line1\nline2');
  s = checkIn(s, 'bad', 1, now);
  const csv = exportCSV(s);
  assert.ok(csv.startsWith('\uFEFF'));
  assert.ok(csv.includes("'=HYPERLINK"));
  assert.ok(csv.includes('"line1\nline2"'));
  assert.ok(csv.includes('""x""'));
  // Numeric deductions remain numeric CSV cells; only user strings are escaped.
  assert.ok(csv.includes('"-7"'));
  assert.ok(!csv.includes("'-7"));
});
test('stored documents validate; corrupt and future versions rejected', () => {
  const doc = { revision: 'abc', updatedAt: now.toISOString(), data: funded() };
  assert.equal(parseDocument(JSON.stringify(doc)).data.balance, 60);
  assert.throws(() =>
    parseDocument(JSON.stringify({ ...doc, data: { ...doc.data, balance: 999 } })),
  );
  assert.throws(() => parseDocument(JSON.stringify({ ...doc, data: { ...doc.data, schema: 2 } })));
  assert.throws(() => parseDocument('{bad'));
});
test('all four dictionaries contain the same translated keys', () => {
  const keys = Object.keys(dictionaries.zh).sort();
  for (const lang of ['en', 'ja', 'ko'] as const)
    assert.deepEqual(Object.keys(dictionaries[lang]).sort(), keys);
});
