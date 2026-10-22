import { pgDateToString } from "../../lib/format";

/** Fields of GET /v1/sips used outside the SIP page. */
export interface SipSummary {
  id: string;
  name: string;
  sip_type: string;
  currency: string;
  monthly_amount: unknown;
  start_date: unknown;
}

/**
 * Next monthly debit (YYYY-MM-DD) on the start date's day of month, today or later.
 * Clamps to the month's last day (a SIP started on the 31st debits on 30 Apr).
 */
export function nextDebit(startRaw: unknown, today = new Date()): string | null {
  const start = pgDateToString(startRaw);
  if (!start) return null;
  const [y, m, d] = start.split("-").map(Number);
  if (!y || !m || !d) return null;
  const t = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const startDate = new Date(y, m - 1, d);
  if (startDate >= t) return start;
  const on = (year: number, month: number) => {
    const last = new Date(year, month + 1, 0).getDate();
    return new Date(year, month, Math.min(d, last));
  };
  let c = on(t.getFullYear(), t.getMonth());
  if (c < t) c = on(t.getFullYear(), t.getMonth() + 1);
  return `${c.getFullYear()}-${String(c.getMonth() + 1).padStart(2, "0")}-${String(c.getDate()).padStart(2, "0")}`;
}
