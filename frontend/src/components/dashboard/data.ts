import { Landmark, Wallet, Banknote, PiggyBank, CreditCard, TrendingUp, ShoppingCart, Coffee, Bus, Receipt, House, Zap, HeartPulse, Film, Plane, GraduationCap, Gift } from "lucide-solid";
import type { Component } from "solid-js";
import { numericToFloat, pgDateToString, pgTextToString } from "../../lib/format";

type Icon = Component<{ class?: string; size?: number }>;

export interface SummaryTx {
  id: string;
  date: unknown;            // pgtype.Date
  title?: unknown;          // pgtype.Text
  account_name: string;
  category_id?: string | null;
  category_name?: unknown;  // pgtype.Text
  amount: unknown;          // pgtype.Numeric
  currency?: string;
  type: "income" | "expense" | "transfer";
  parent_recurring_id?: string | null;
  is_recurring?: boolean;
}

export interface AccountBalance {
  id: string;
  name: string;
  type: string;
  currency: string;
  balance: number;
  credit_limit?: number | null;
}

export interface BudgetStatus { id?: string; name: string; spent: number; amount: number; remaining?: number; spent_pct: number; currency?: string }
export interface MonthlyFlow { date: string; total_balance: number; income?: number; expense?: number }

export interface Summary {
  total_income: number;
  total_expenses: number;
  recent_transactions: SummaryTx[] | null;
  account_balances: AccountBalance[] | null;
  budget_status: BudgetStatus[] | null;
  monthly_networth: MonthlyFlow[] | null;
  category_spending: Array<{ category_id: string; category_name: string; color: string; total: number }> | null;
}

export interface NetWorthData { total_assets: number; total_liabilities: number; networth: number }
export interface Snapshot { id: string; as_of: string; currency: string; networth: number }

/** A transaction row normalised from the summary's pgtype fields. */
export interface Row {
  id: string;
  date: string;
  title: string;
  account: string;
  category: string;
  categoryKey: string;
  amount: number;
  currency?: string;
  type: "income" | "expense" | "transfer";
  recurring: boolean;
}

export function toRow(t: SummaryTx): Row {
  const category = pgTextToString(t.category_name) || (t.type === "transfer" ? "Transfer" : "Uncategorized");
  return {
    id: t.id,
    date: pgDateToString(t.date),
    title: pgTextToString(t.title) || "—",
    account: t.account_name,
    category,
    categoryKey: t.category_id || category,
    amount: Math.abs(numericToFloat(t.amount)),
    currency: t.currency,
    type: t.type,
    recurring: !!t.parent_recurring_id || !!t.is_recurring,
  };
}

/** Stable category colour: hash the category onto the six Luxe category tokens. */
export function categoryColor(key: string): string {
  let h = 0;
  for (let i = 0; i < key.length; i++) h = (h * 31 + key.charCodeAt(i)) >>> 0;
  return `var(--color-cat-${(h % 6) + 1})`;
}

export function categoryIcon(category: string): Icon {
  const c = category.toLowerCase();
  if (c.includes("grocer")) return ShoppingCart;
  if (c.includes("dining") || c.includes("food") || c.includes("coffee") || c.includes("restaurant")) return Coffee;
  if (c.includes("transport") || c.includes("fuel") || c.includes("cab")) return Bus;
  if (c.includes("travel") || c.includes("flight")) return Plane;
  if (c.includes("rent") || c.includes("home") || c.includes("housing")) return House;
  if (c.includes("util") || c.includes("electric") || c.includes("bill")) return Zap;
  if (c.includes("health") || c.includes("medical")) return HeartPulse;
  if (c.includes("entertain") || c.includes("movie") || c.includes("subscription")) return Film;
  if (c.includes("educat")) return GraduationCap;
  if (c.includes("gift")) return Gift;
  if (c.includes("income") || c.includes("salary")) return Banknote;
  return Receipt;
}

export function accountIcon(type: string): Icon {
  switch (type) {
    case "bank": return Landmark;
    case "savings": return PiggyBank;
    case "credit_card": return CreditCard;
    case "investment": return TrendingUp;
    case "cash": return Banknote;
    default: return Wallet;
  }
}

const MONTH_SHORT = new Intl.DateTimeFormat("en-US", { month: "short" });
export const monthShort = (ym: string) => {
  const [y, m] = ym.split("-").map(Number);
  return MONTH_SHORT.format(new Date(y!, (m ?? 1) - 1, 1));
};

export function addMonths(ym: string, delta: number): string {
  const [y, m] = ym.split("-").map(Number);
  const d = new Date(y!, (m ?? 1) - 1 + delta, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

/** The `count` months ending at `end` (YYYY-MM), with zero-filled flows. */
export function lastMonths(flows: MonthlyFlow[], end: string, count: number): Array<{ month: string; income: number; expense: number; net: number }> {
  const byMonth = new Map(flows.map((f) => [f.date.slice(0, 7), f]));
  const out = [];
  for (let i = count - 1; i >= 0; i--) {
    const month = addMonths(end, -i);
    const f = byMonth.get(month);
    out.push({ month, income: f?.income ?? 0, expense: f?.expense ?? 0, net: f?.total_balance ?? 0 });
  }
  return out;
}

export type NetWorthPoint = { month: string; value: number };

/**
 * Estimate month-end net worth from the current value and monthly net cash
 * flow: the value at the end of month m is today's value minus the flow of
 * every later month. Used only when there are no saved snapshots.
 */
export function deriveNetWorth(current: number, flows: MonthlyFlow[], end: string, count = 6): NetWorthPoint[] {
  const months = lastMonths(flows, end, count);
  const points: NetWorthPoint[] = [];
  let value = current;
  for (let i = months.length - 1; i >= 0; i--) {
    points.unshift({ month: months[i]!.month, value });
    value -= months[i]!.net;
  }
  return points;
}

/** One point per month (the last snapshot in each month), oldest first. */
export function snapshotSeries(snaps: Snapshot[]): NetWorthPoint[] {
  const byMonth = new Map<string, Snapshot>();
  for (const s of [...snaps].sort((a, b) => a.as_of.localeCompare(b.as_of))) byMonth.set(s.as_of.slice(0, 7), s);
  return [...byMonth.entries()].map(([month, s]) => ({ month, value: s.networth }));
}

export type Range = "3M" | "1Y" | "ALL";
export function sliceRange(points: NetWorthPoint[], range: Range): NetWorthPoint[] {
  if (range === "ALL") return points;
  const n = range === "3M" ? 4 : 13; // include the starting month so the delta covers the range
  return points.slice(-n);
}

/** Sample labels so at most `max` are shown, always keeping the last. */
export function sampleLabels(points: NetWorthPoint[], max = 12): string[] {
  if (points.length <= max) return points.map((p) => monthShort(p.month));
  const step = Math.ceil(points.length / max);
  return points.filter((_, i) => (points.length - 1 - i) % step === 0).map((p) => monthShort(p.month));
}

export { compactMoney } from "../../lib/format";

export function daysLeftInMonth(ym: string): number | null {
  const now = new Date();
  const cur = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  if (ym !== cur) return null;
  const last = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  return last - now.getDate() + 1;
}
