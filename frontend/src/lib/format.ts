const CURRENCY_KEY = "ledgerify.currency";

// ---------------------------------------------------------------------------
// pgtype helpers — Go's pgx serialises pgtype.Numeric, pgtype.Text, and
// pgtype.Date as wrapped objects.  These helpers unwrap them safely so pages
// don't need copy-pasted converters.
// ---------------------------------------------------------------------------

/** Unwrap a pgtype.Numeric (or plain number/string) to a JS number. */
export function numericToFloat(v: unknown): number {
  if (typeof v === "number") return v;
  if (typeof v === "string") return parseFloat(v) || 0;
  if (v && typeof v === "object") {
    const o = v as Record<string, unknown>;
    if ("Int" in o && "Exp" in o) {
      if (!o["Valid"]) return 0;
      return (o["Int"] as number) * Math.pow(10, o["Exp"] as number);
    }
  }
  return 0;
}

/** Unwrap a pgtype.Text (or plain string) to a JS string. */
export function pgTextToString(v: unknown): string {
  if (typeof v === "string") return v;
  if (v && typeof v === "object") {
    const o = v as { String: string; Valid: boolean };
    return o.Valid ? o.String : "";
  }
  return "";
}

/** Unwrap a pgtype.Date (or plain string) to a YYYY-MM-DD string. */
export function pgDateToString(v: unknown): string {
  if (typeof v === "string") return v.slice(0, 10);
  if (v && typeof v === "object") {
    const o = v as { Time: string; Valid: boolean };
    return o.Valid ? o.Time.slice(0, 10) : "";
  }
  return "";
}

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
