import { AppData } from './model';
import { isScheduled } from './engine';
import { addDays, dateKey } from './time';
export function streak(s: AppData, today = dateKey()): number {
  const dates = new Set(s.checkIns.filter((c) => c.kind === 'good').map((c) => c.date));
  let day = dates.has(today) ? today : addDays(today, -1),
    count = 0;
  while (dates.has(day)) {
    count++;
    day = addDays(day, -1);
  }
  return count;
}
/** Completion refers only to positive habits: not doing a bad habit is success,
 * so logging a bad event must never inflate the completion percentage. */
export function completion(s: AppData, today = dateKey()): number {
  const habits = s.habits.filter((h) => h.kind === 'good' && isScheduled(h, today));
  const target = habits.reduce((n, h) => n + h.limit, 0);
  if (!target) return 0;
  const done = habits.reduce(
    (n, h) =>
      n +
      Math.min(
        h.limit,
        s.checkIns
          .filter((c) => c.habitId === h.id && c.date === today)
          .reduce((v, c) => v + c.fraction, 0),
      ),
    0,
  );
  return Math.round((100 * done) / target);
}
export function trend(s: AppData, days: number, today = dateKey()) {
  return Array.from({ length: days }, (_, i) => {
    const date = addDays(today, i - days + 1);
    const entries = s.ledger.filter((e) => e.date === date);
    return { date, delta: entries.reduce((n, e) => n + e.delta, 0) };
  });
}
