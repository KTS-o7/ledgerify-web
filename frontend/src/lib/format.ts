const CURRENCY_KEY = "ledgerify.currency";

export function getCurrency(): string {
  if (typeof localStorage !== "undefined") {
    const stored = localStorage.getItem(CURRENCY_KEY);
    if (stored) return stored;
  }
  return "INR";
}

export function formatCurrency(n: number, currency?: string): string {
  const c = currency ?? getCurrency();
  return new Intl.NumberFormat("en-IN", {
    style: "currency", currency: c, maximumFractionDigits: 0,
  }).format(n);
}

const SHORT_DATE = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric" });

export function formatDate(iso: string): string {
  return SHORT_DATE.format(new Date(iso));
}

export function formatDateGroup(iso: string): string {
  const d = new Date(iso);
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const yesterday = new Date(today); yesterday.setDate(today.getDate() - 1);
  const dStart = new Date(d); dStart.setHours(0, 0, 0, 0);
  if (dStart.getTime() === today.getTime()) return "Today";
  if (dStart.getTime() === yesterday.getTime()) return "Yesterday";
  return SHORT_DATE.format(d);
}
