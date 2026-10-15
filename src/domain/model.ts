/** Dates are local calendar dates, never UTC dates. Money-like points use integer
 * half-points internally to avoid floating point drift (1 unit = 0.5 points). */
export type Language = 'zh' | 'en' | 'ja' | 'ko';
export type HabitKind = 'good' | 'bad';
export type Cycle =
  | { mode: 'daily' }
  | { mode: 'weekdays'; days: number[] }
  | { mode: 'interval'; every: number; anchor: string };
export interface Habit {
  id: string;
  name: string;
  kind: HabitKind;
  points: number;
  limit: number;
  cycle: Cycle;
  halfEnabled: boolean;
  reminder: string | null;
  createdOn: string;
}
export interface Reward {
  id: string;
  name: string;
  cost: number;
}
export interface CheckIn {
  id: string;
  habitId: string;
  name: string;
  kind: HabitKind;
  date: string;
  at: string;
  fraction: 0.5 | 1;
  delta: number;
  note: string;
  /** Snapshot of target for historical statistics even after editing/deleting. */
  target: number;
}
export interface LedgerEntry {
  id: string;
  at: string;
  date: string;
  name: string;
  kind: 'checkIn' | 'redemption' | 'weeklyReset';
  delta: number;
  balance: number;
  referenceId: string;
}
export interface Redemption {
  id: string;
  rewardId: string;
  name: string;
  cost: number;
  at: string;
}
export interface Exemption {
  id: string;
  week: string;
  date: string;
  at: string;
}
export interface Settings {
  language: Language;
  dailyCap: number;
  floor: number;
  weeklyReset: boolean;
}
/** 单文档持久化边界：关联记录与积分余额一起写入，保证一次操作完整落盘。 */
export interface AppData {
  schema: 1;
  habits: Habit[];
  rewards: Reward[];
  checkIns: CheckIn[];
  ledger: LedgerEntry[];
  redemptions: Redemption[];
  exemptions: Exemption[];
  settings: Settings;
  balance: number;
  activeWeek: string;
}
export interface Document {
  revision: string;
  updatedAt: string;
  data: AppData;
}
export type DomainError =
  | 'notScheduled'
  | 'limitReached'
  | 'halfDisabled'
  | 'insufficient'
  | 'cardUsed'
  | 'invalid'
  | 'notFound';
export class RuleError extends Error {
  constructor(public code: DomainError) {
    super(code);
  }
}
