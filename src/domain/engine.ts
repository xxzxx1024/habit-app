import {
  AppData,
  CheckIn,
  Cycle,
  Habit,
  Language,
  LedgerEntry,
  Reward,
  RuleError,
  Settings,
} from './model';
import { dateKey, daysBetween, fromKey, weekKey } from './time';

export function id(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}-${Math.random().toString(36).slice(2)}`;
}
export const units = (points: number): number => Math.round(points * 2);
export const points = (value: number): number => value / 2;
export function initialData(language: Language = 'zh', now = new Date()): AppData {
  return {
    schema: 1,
    habits: [],
    rewards: [],
    checkIns: [],
    ledger: [],
    redemptions: [],
    exemptions: [],
    settings: { language, dailyCap: 60, floor: -20, weeklyReset: false },
    balance: 0,
    activeWeek: weekKey(now),
  };
}
/** Pure immutable functions are shared by UI, restore validation and tests. No IO. */
function append(s: AppData, entry: Omit<LedgerEntry, 'id' | 'balance'>): AppData {
  const balance = s.balance + entry.delta;
  return { ...s, balance, ledger: [...s.ledger, { ...entry, id: id(), balance }] };
}
/** 周切换只执行一次：关闭应用期间无需运行定时器，下次操作时补记清零流水。
 * 所有积分变化都经过 append，从而同时维护余额和变动后的流水余额。 */
export function rollover(s: AppData, now = new Date()): AppData {
  const week = weekKey(now);
  if (week === s.activeWeek) return s;
  // Keep old cards as audit history; availability is derived, never accumulated.
  const next = { ...s, activeWeek: week };
  if (!s.settings.weeklyReset) return next;
  return append(next, {
    at: now.toISOString(),
    date: dateKey(now),
    name: 'weeklyReset',
    kind: 'weeklyReset',
    delta: s.balance === 0 ? 0 : -s.balance,
    referenceId: week,
  });
}
export function isScheduled(h: Habit, day: string): boolean {
  if (day < h.createdOn) return false;
  if (h.cycle.mode === 'daily') return true;
  if (h.cycle.mode === 'weekdays') return h.cycle.days.includes(fromKey(day).getDay());
  const distance = daysBetween(h.cycle.anchor, day);
  return distance >= 0 && distance % h.cycle.every === 0;
}
export function earnedToday(s: AppData, day: string): number {
  return s.checkIns
    .filter((c) => c.date === day && c.kind === 'good')
    .reduce((n, c) => n + Math.max(c.delta, 0), 0);
}
export function cardAvailable(s: AppData, now = new Date()): boolean {
  return !s.exemptions.some((e) => e.week === weekKey(now));
}
export function isExempt(s: AppData, day: string): boolean {
  return s.exemptions.some((e) => e.date === day);
}
/** 打卡事务的唯一入口。先校验计划、次数和半完成权限，再算实际积分。
 * 即使被上限、下限或豁免拦截为 0 分，也保存打卡和流水，方便补写日志。 */
export function checkIn(
  input: AppData,
  habitId: string,
  fraction: 0.5 | 1,
  now = new Date(),
): AppData {
  const s = rollover(input, now),
    day = dateKey(now),
    h = s.habits.find((h) => h.id === habitId);
  if (!h) throw new RuleError('notFound');
  if (!isScheduled(h, day)) throw new RuleError('notScheduled');
  if (fraction !== 1 && fraction !== 0.5) throw new RuleError('invalid');
  if (fraction === 0.5 && !h.halfEnabled) throw new RuleError('halfDisabled');
  if (s.checkIns.filter((c) => c.habitId === h.id && c.date === day).length >= h.limit)
    throw new RuleError('limitReached');
  // 单次积分必须对应偶数个内部单位，乘以 0.5 后仍是整数，不产生浮点误差。
  let delta = Math.round(h.points * fraction);
  if (isExempt(s, day)) delta = 0;
  // 加分额度按今日累计正向收入计算，扣分或兑换不释放额度。
  else if (h.kind === 'good')
    delta = Math.min(delta, Math.max(0, s.settings.dailyCap - earnedToday(s, day)));
  // 下限约束总余额；已低于新下限时最多扣 0，不能反向给用户加分。
  else delta = -Math.min(delta, Math.max(0, s.balance - s.settings.floor));
  if (Object.is(delta, -0)) delta = 0;
  const c: CheckIn = {
    id: id(),
    habitId,
    name: h.name,
    kind: h.kind,
    date: day,
    at: now.toISOString(),
    fraction,
    delta,
    note: '',
    target: h.limit,
  };
  return append(
    { ...s, checkIns: [...s.checkIns, c] },
    { at: c.at, date: day, name: h.name, kind: 'checkIn', delta, referenceId: c.id },
  );
}
export function useCard(input: AppData, now = new Date()): AppData {
  const s = rollover(input, now);
  if (!cardAvailable(s, now)) throw new RuleError('cardUsed');
  return {
    ...s,
    exemptions: [
      ...s.exemptions,
      { id: id(), week: weekKey(now), date: dateKey(now), at: now.toISOString() },
    ],
  };
}
/** 足额校验、扣分和兑换历史使用同一份不可变状态提交，避免中间态。 */
export function redeem(input: AppData, rewardId: string, now = new Date()): AppData {
  const s = rollover(input, now),
    reward = s.rewards.find((r) => r.id === rewardId);
  if (!reward) throw new RuleError('notFound');
  if (s.balance < reward.cost) throw new RuleError('insufficient');
  const r = { id: id(), rewardId, name: reward.name, cost: reward.cost, at: now.toISOString() };
  return append(
    { ...s, redemptions: [...s.redemptions, r] },
    {
      at: r.at,
      date: dateKey(now),
      name: r.name,
      kind: 'redemption',
      delta: -r.cost,
      referenceId: r.id,
    },
  );
}
function validCycle(c: Cycle): boolean {
  return (
    c.mode === 'daily' ||
    (c.mode === 'weekdays' &&
      c.days.length > 0 &&
      c.days.every((d) => Number.isInteger(d) && d >= 0 && d <= 6)) ||
    (c.mode === 'interval' &&
      Number.isInteger(c.every) &&
      c.every >= 1 &&
      c.every <= 365 &&
      /^\d{4}-\d{2}-\d{2}$/.test(c.anchor))
  );
}
export function saveHabit(s: AppData, h: Habit): AppData {
  if (
    !h.name.trim() ||
    h.name.length > 80 ||
    !['good', 'bad'].includes(h.kind) ||
    !Number.isInteger(h.points) ||
    h.points % 2 !== 0 ||
    h.points <= 0 ||
    h.points > 20000 ||
    !Number.isInteger(h.limit) ||
    h.limit < 1 ||
    h.limit > 100 ||
    !validCycle(h.cycle) ||
    (h.reminder !== null && !/^([01]\d|2[0-3]):[0-5]\d$/.test(h.reminder))
  )
    throw new RuleError('invalid');
  const habit = { ...h, name: h.name.trim() };
  return {
    ...s,
    habits: s.habits.some((x) => x.id === h.id)
      ? s.habits.map((x) => (x.id === h.id ? habit : x))
      : [...s.habits, habit],
  };
}
export function saveReward(s: AppData, r: Reward): AppData {
  if (
    !r.name.trim() ||
    r.name.length > 80 ||
    !Number.isInteger(r.cost) ||
    r.cost < 1 ||
    r.cost > 2000000
  )
    throw new RuleError('invalid');
  const reward = { ...r, name: r.name.trim() };
  return {
    ...s,
    rewards: s.rewards.some((x) => x.id === r.id)
      ? s.rewards.map((x) => (x.id === r.id ? reward : x))
      : [...s.rewards, reward],
  };
}
export function updateSettings(input: AppData, settings: Settings, now = new Date()): AppData {
  if (
    !Number.isInteger(settings.dailyCap) ||
    settings.dailyCap < 0 ||
    settings.dailyCap > 2000000 ||
    !Number.isInteger(settings.floor) ||
    settings.floor > 0 ||
    settings.floor < -2000000 ||
    !['zh', 'en', 'ja', 'ko'].includes(settings.language)
  )
    throw new RuleError('invalid');
  // Materialize an elapsed week's reset using the OLD policy first. Changing
  // policy never rewrites history or invents a retroactive reset.
  return { ...rollover(input, now), settings };
}
export function setNote(s: AppData, checkInId: string, note: string): AppData {
  if (note.length > 2000) throw new RuleError('invalid');
  return { ...s, checkIns: s.checkIns.map((c) => (c.id === checkInId ? { ...c, note } : c)) };
}
/** 只重置进度；设置、习惯和奖励模板沿用原数据。同步层会生成新版本。 */
export function resetProgress(s: AppData, now = new Date()): AppData {
  return {
    ...initialData(s.settings.language, now),
    habits: s.habits,
    rewards: s.rewards,
    settings: s.settings,
  };
}
