import { Landmark, Wallet, Banknote, PiggyBank, CreditCard, TrendingUp, Globe } from "lucide-solid";
import type { Component } from "solid-js";

export interface AccountBalance {
  id: string;
  name: string;
  type: string;
  currency: string;
  balance: number;
  credit_limit?: number | null;
}

export type AccountGroupKey = "bank" | "credit" | "foreign" | "investment" | "other";
export type AccountGroup = { key: AccountGroupKey; label: string; accounts: AccountBalance[] };

const GROUP_LABELS: Record<AccountGroupKey, string> = {
  bank: "Bank & cash",
  credit: "Credit cards",
  foreign: "Foreign wallets",
  investment: "Investment",
  other: "Other",
};
const GROUP_ORDER: AccountGroupKey[] = ["bank", "credit", "foreign", "investment", "other"];

export const TYPE_LABEL: Record<string, string> = {
  bank: "Bank", wallet: "Wallet", cash: "Cash", savings: "Savings",
  credit_card: "Credit card", investment: "Investment",
};

export function accountIcon(type: string, foreign = false): Component<{ size?: number; class?: string }> {
  if (foreign) return Globe;
  switch (type) {
    case "bank": return Landmark;
    case "wallet": return Wallet;
    case "cash": return Banknote;
    case "savings": return PiggyBank;
    case "credit_card": return CreditCard;
    case "investment": return TrendingUp;
    default: return Wallet;
  }
}

/** Which group an account belongs in. Non-default-currency bank/cash/wallets are "foreign". */
export function groupFor(a: AccountBalance, baseCurrency: string): AccountGroupKey {
  if (a.type === "credit_card") return "credit";
  if (a.type === "investment") return "investment";
  if (["bank", "cash", "wallet", "savings"].includes(a.type)) {
    return a.currency && a.currency !== baseCurrency ? "foreign" : "bank";
  }
  return "other";
}

export function groupAccounts(list: AccountBalance[], baseCurrency: string): AccountGroup[] {
  const by = new Map<AccountGroupKey, AccountBalance[]>();
  for (const a of list) {
    const k = groupFor(a, baseCurrency);
    by.set(k, [...(by.get(k) ?? []), a]);
  }
  return GROUP_ORDER.filter((k) => by.has(k)).map((k) => ({ key: k, label: GROUP_LABELS[k], accounts: by.get(k)! }));
}

/** Sum balances per currency, base currency first, then by account count. */
export function totalsByCurrency(list: AccountBalance[], baseCurrency: string): Array<{ currency: string; total: number }> {
  const sums = new Map<string, { total: number; n: number }>();
  for (const a of list) {
    const c = a.currency || baseCurrency;
    const cur = sums.get(c) ?? { total: 0, n: 0 };
    sums.set(c, { total: cur.total + a.balance, n: cur.n + 1 });
  }
  return [...sums.entries()]
    .sort(([a, x], [b, y]) => (a === baseCurrency ? -1 : b === baseCurrency ? 1 : y.n - x.n))
    .map(([currency, v]) => ({ currency, total: v.total }));
}

/** Credit utilisation in %, from a card balance (negative = owed) and its limit. */
export function utilisation(balance: number, limit?: number | null): number | null {
  if (!limit || limit <= 0) return null;
  return (Math.max(0, -balance) / limit) * 100;
}

/** Compact amount for the totals strip, e.g. ₹16.9L, $6,240. */
export function compactMoney(value: number, currency: string): string {
  const abs = Math.abs(value);
  const s = new Intl.NumberFormat("en-IN", {
    style: "currency", currency,
    notation: abs >= 100000 ? "compact" : "standard",
    maximumFractionDigits: abs >= 100000 ? 1 : 0,
  }).format(abs);
  return value < 0 ? `−${s}` : s;
}

/** pgtype.UUID can arrive as a string or a wrapped object. */
export function idOf(id: unknown): string {
  if (typeof id === "string") return id;
  const o = id as { String?: string } | null;
  return o?.String ?? "";
}
