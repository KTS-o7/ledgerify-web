/** Pure helpers for budget pace. Kept free of Solid so they are easy to test. */

export type BudgetLike = { amount: number; spent: number; period_type: string; currency: string };

/** Fraction (0–1) of the current period that has elapsed, counting today as elapsed. */
export function periodElapsed(periodType: string, now = new Date()): number {
  if (periodType === "weekly") {
    const dow = (now.getDay() + 6) % 7; // Monday = 0
    return (dow + 1) / 7;
  }
  const days = daysInMonth(now);
  return now.getDate() / days;
}

export function daysInMonth(d: Date): number {
  return new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
}

/** Days left in the current month, excluding today. */
export function daysLeftInMonth(now = new Date()): number {
  return daysInMonth(now) - now.getDate();
}

export type PaceSummary = {
  limit: number;
  spent: number;
  remaining: number;
  /** Spend you would expect by today if spending were even across each period. */
  expected: number;
  /** spent − expected: positive means over pace. */
  delta: number;
  spentPct: number;
  elapsedPct: number;
  count: number;
};

/** Aggregate budgets that share one currency into a pace summary. */
export function paceSummary(budgets: BudgetLike[], now = new Date()): PaceSummary {
  let limit = 0, spent = 0, expected = 0;
  for (const b of budgets) {
    limit += b.amount;
    spent += b.spent;
    expected += b.amount * periodElapsed(b.period_type, now);
  }
  return {
    limit,
    spent,
    remaining: limit - spent,
    expected,
    delta: spent - expected,
    spentPct: limit > 0 ? (spent / limit) * 100 : 0,
    elapsedPct: limit > 0 ? (expected / limit) * 100 : 0,
    count: budgets.length,
  };
}

/** Percentage change from `prev` to `cur`, or null when there is no baseline. */
export function pctChange(cur: number, prev: number): number | null {
  if (!prev) return null;
  return ((cur - prev) / prev) * 100;
}
