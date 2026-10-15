import { z } from 'zod';
import { Document } from './model';
const key = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine((s) => {
    const d = new Date(`${s}T12:00:00Z`);
    return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s;
  });
const int = z.number().int().safe();
const positive = int.min(1);
const identifier = z
  .string()
  .min(1)
  .max(160)
  .regex(/^[a-zA-Z0-9-]+$/);
const at = z.string().datetime();
const name = z.string().trim().min(1).max(80);
const kind = z.enum(['good', 'bad']);
const cycle = z.discriminatedUnion('mode', [
  z.object({ mode: z.literal('daily') }),
  z.object({ mode: z.literal('weekdays'), days: z.array(int.min(0).max(6)).min(1).max(7) }),
  z.object({ mode: z.literal('interval'), every: positive.max(365), anchor: key }),
]);
const data = z
  .object({
    schema: z.literal(1),
    balance: int,
    activeWeek: key,
    habits: z.array(
      z.object({
        id: identifier,
        name,
        kind,
        points: positive.max(20000).refine((n) => n % 2 === 0),
        limit: positive.max(100),
        cycle,
        halfEnabled: z.boolean(),
        reminder: z
          .string()
          .regex(/^([01]\d|2[0-3]):[0-5]\d$/)
          .nullable(),
        createdOn: key,
      }),
    ),
    rewards: z.array(z.object({ id: identifier, name, cost: positive.max(2000000) })),
    checkIns: z.array(
      z.object({
        id: identifier,
        habitId: identifier,
        name,
        kind,
        date: key,
        at,
        fraction: z.union([z.literal(0.5), z.literal(1)]),
        delta: int,
        note: z.string().max(2000),
        target: positive.max(100),
      }),
    ),
    ledger: z.array(
      z.object({
        id: identifier,
        at,
        date: key,
        name: z.string(),
        kind: z.enum(['checkIn', 'redemption', 'weeklyReset']),
        delta: int,
        balance: int,
        referenceId: z.string(),
      }),
    ),
    redemptions: z.array(
      z.object({ id: identifier, rewardId: identifier, name, cost: positive, at }),
    ),
    exemptions: z.array(z.object({ id: identifier, week: key, date: key, at })),
    settings: z.object({
      language: z.enum(['zh', 'en', 'ja', 'ko']),
      dailyCap: int.min(0).max(2000000),
      floor: int.min(-2000000).max(0),
      weeklyReset: z.boolean(),
    }),
  })
  .superRefine((s, ctx) => {
    let balance = 0;
    for (const entry of s.ledger) {
      balance += entry.delta;
      if (balance !== entry.balance) ctx.addIssue({ code: 'custom', message: 'Ledger mismatch' });
    }
    if (balance !== s.balance) ctx.addIssue({ code: 'custom', message: 'Balance mismatch' });
    for (const list of [s.habits, s.rewards, s.checkIns, s.ledger, s.redemptions, s.exemptions]) {
      if (new Set(list.map((x) => x.id)).size !== list.length)
        ctx.addIssue({ code: 'custom', message: 'Duplicate ID' });
    }
  });
export const documentSchema = z.object({ revision: identifier, updatedAt: at, data });
/** Refuse unknown/corrupt data rather than falling back to an empty database. */
export function parseDocument(raw: string): Document {
  return documentSchema.parse(JSON.parse(raw));
}
