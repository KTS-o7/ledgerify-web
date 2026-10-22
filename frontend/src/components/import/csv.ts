/**
 * Client-side CSV handling for the import flow.
 *
 * POST /api/v1/import reads columns by exact header name (title, amount, type,
 * date, account; optional currency, category, note) and accepts dates as
 * YYYY-MM-DD, DD/MM/YYYY or MM/DD/YYYY. Bank exports rarely look like that, so
 * the browser maps the user's columns onto those names, normalises each row,
 * and uploads a rewritten CSV. Nothing is saved until the final upload.
 */

/** Parse CSV text (RFC 4180: quoted fields, "" escapes, CRLF/LF). Drops a UTF-8 BOM and blank lines. */
export function parseCsv(text: string): string[][] {
  const src = text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;
  for (let i = 0; i < src.length; i++) {
    const ch = src[i]!;
    if (quoted) {
      if (ch === '"') {
        if (src[i + 1] === '"') { field += '"'; i++; }
        else quoted = false;
      } else field += ch;
      continue;
    }
    if (ch === '"') quoted = true;
    else if (ch === ",") { row.push(field); field = ""; }
    else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && src[i + 1] === "\n") i++;
      row.push(field); field = "";
      if (row.some((c) => c.trim() !== "")) rows.push(row);
      row = [];
    } else field += ch;
  }
  row.push(field);
  if (row.some((c) => c.trim() !== "")) rows.push(row);
  return rows;
}

function quote(v: string): string {
  return /[",\r\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v;
}

export function toCsv(rows: string[][]): string {
  return rows.map((r) => r.map(quote).join(",")).join("\n") + "\n";
}

// ---------------------------------------------------------------------------
// Mapping
// ---------------------------------------------------------------------------

export type TxType = "income" | "expense" | "transfer" | "credit_payment";
export type AmountMode = "amount-type" | "signed" | "debit-credit";
export type DateFormat = "YYYY-MM-DD" | "DD/MM/YYYY" | "MM/DD/YYYY" | "DD-MM-YYYY" | "DD-MMM-YYYY" | "DD MMM YYYY";

export const DATE_FORMATS: DateFormat[] = ["YYYY-MM-DD", "DD/MM/YYYY", "MM/DD/YYYY", "DD-MM-YYYY", "DD-MMM-YYYY", "DD MMM YYYY"];

/** Column index per field; -1 = not mapped. */
export type Mapping = {
  title: number;
  date: number;
  amount: number;
  type: number;
  debit: number;
  credit: number;
  account: number;
  category: number;
  currency: number;
  note: number;
  amountMode: AmountMode;
  dateFormat: DateFormat;
  /** Used when `account` is -1: every row goes to this account name. */
  fixedAccount: string;
  /** Used when `currency` is -1. Empty = let the server default to INR. */
  fixedCurrency: string;
};

export type MappedField = "title" | "date" | "amount" | "type" | "debit" | "credit" | "account" | "category" | "currency" | "note";

const SYNONYMS: Record<MappedField, string[]> = {
  title: ["title", "description", "narration", "merchant", "particulars", "details", "payee", "name", "transaction details", "remarks"],
  date: ["date", "txn date", "transaction date", "value date", "posting date", "tran date"],
  amount: ["amount", "amt", "transaction amount", "value"],
  type: ["type", "transaction type", "txn type", "dr/cr", "cr/dr"],
  debit: ["debit", "withdrawal", "withdrawal amt", "withdrawal amount", "debit amount", "dr", "paid out"],
  credit: ["credit", "deposit", "deposit amt", "deposit amount", "credit amount", "cr", "paid in"],
  account: ["account", "account name", "bank"],
  category: ["category", "categories"],
  currency: ["currency", "ccy", "cur"],
  note: ["note", "notes", "memo", "reference", "ref", "ref no", "chq/ref no"],
};

const norm = (s: string) => s.trim().toLowerCase().replace(/[._]+/g, " ").replace(/\s+/g, " ").replace(/\.$/, "");

/** Guess a mapping from header names. */
export function guessMapping(headers: string[], sample: string[][]): Mapping {
  const used = new Set<number>();
  const find = (field: MappedField) => {
    const names = SYNONYMS[field];
    for (const n of names) {
      const i = headers.findIndex((h, idx) => !used.has(idx) && norm(h) === n);
      if (i >= 0) { used.add(i); return i; }
    }
    for (const n of names) {
      if (n.length < 4) continue;
      const i = headers.findIndex((h, idx) => !used.has(idx) && norm(h).includes(n));
      if (i >= 0) { used.add(i); return i; }
    }
    return -1;
  };
  // Order matters: specific names claim their column before looser matches.
  const date = find("date");
  const debit = find("debit");
  const credit = find("credit");
  const amount = find("amount");
  const type = find("type");
  const title = find("title");
  const account = find("account");
  const category = find("category");
  const currency = find("currency");
  const note = find("note");

  const amountMode: AmountMode =
    debit >= 0 && credit >= 0 ? "debit-credit" : amount >= 0 && type >= 0 ? "amount-type" : "signed";
  const dates = date >= 0 ? sample.map((r) => r[date] ?? "").filter(Boolean) : [];
  return {
    title, date, amount, type, debit, credit, account, category, currency, note,
    amountMode,
    dateFormat: detectDateFormat(dates),
    fixedAccount: "",
    fixedCurrency: "",
  };
}

// ---------------------------------------------------------------------------
// Value parsing
// ---------------------------------------------------------------------------

const MONTHS = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];

function iso(y: number, m: number, d: number): string | null {
  if (y < 100) y += 2000;
  if (m < 1 || m > 12 || d < 1 || d > 31) return null;
  const dt = new Date(Date.UTC(y, m - 1, d));
  if (dt.getUTCMonth() !== m - 1) return null; // e.g. 31/02
  return `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

/** Parse a date in the given format to YYYY-MM-DD, or null. */
export function parseDate(raw: string, fmt: DateFormat): string | null {
  const s = raw.trim().split(/[ T]\d{1,2}:\d{2}/)[0]!.trim(); // drop a trailing time
  let m: RegExpMatchArray | null;
  switch (fmt) {
    case "YYYY-MM-DD":
      m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
      return m ? iso(+m[1]!, +m[2]!, +m[3]!) : null;
    case "DD/MM/YYYY":
      m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/);
      return m ? iso(+m[3]!, +m[2]!, +m[1]!) : null;
    case "MM/DD/YYYY":
      m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/);
      return m ? iso(+m[3]!, +m[1]!, +m[2]!) : null;
    case "DD-MM-YYYY":
      m = s.match(/^(\d{1,2})-(\d{1,2})-(\d{2,4})$/);
      return m ? iso(+m[3]!, +m[2]!, +m[1]!) : null;
    case "DD-MMM-YYYY":
    case "DD MMM YYYY": {
      m = s.match(/^(\d{1,2})[- ]([A-Za-z]{3})[A-Za-z]*[- ,]+(\d{2,4})$/);
      if (!m) return null;
      const mon = MONTHS.indexOf(m[2]!.toLowerCase()) + 1;
      return mon ? iso(+m[3]!, mon, +m[1]!) : null;
    }
  }
}

/** Pick the format that parses the most sample dates; DD/MM wins ties with MM/DD, as on Indian statements. */
export function detectDateFormat(samples: string[]): DateFormat {
  const xs = samples.filter((s) => s.trim() !== "");
  let best: DateFormat = "YYYY-MM-DD";
  let bestHits = 0;
  for (const f of DATE_FORMATS) {
    const hits = xs.filter((s) => parseDate(s, f) !== null).length;
    if (hits > bestHits) { best = f; bestHits = hits; }
  }
  return best;
}

/** Parse "₹1,23,456.78", "(500)", "-42", "1 200 CR" → number, or null. */
export function parseAmount(raw: string): number | null {
  let s = raw.trim();
  if (!s) return null;
  let neg = false;
  if (/^\(.*\)$/.test(s)) { neg = true; s = s.slice(1, -1); }
  if (/\bdr\.?$/i.test(s)) { neg = true; s = s.replace(/\bdr\.?$/i, ""); }
  s = s.replace(/\bcr\.?$/i, "");
  s = s.replace(/[^\d.\-+]/g, "");
  if (s.startsWith("-")) { neg = !neg; s = s.slice(1); }
  else if (s.startsWith("+")) s = s.slice(1);
  if (!/^\d*\.?\d+$|^\d+\.$/.test(s)) return null;
  const n = parseFloat(s);
  return Number.isFinite(n) ? (neg ? -n : n) : null;
}

/** Map a type cell to a server type. Accepts common bank spellings. */
export function parseType(raw: string): TxType | null {
  const s = raw.trim().toLowerCase();
  if (["income", "credit", "cr", "deposit", "c"].includes(s)) return "income";
  if (["expense", "debit", "dr", "withdrawal", "d"].includes(s)) return "expense";
  if (s === "transfer") return "transfer";
  if (s === "credit_payment" || s === "credit payment") return "credit_payment";
  return null;
}

// ---------------------------------------------------------------------------
// Rows
// ---------------------------------------------------------------------------

export type RowStatus = "ready" | "invalid";

export type ReviewRow = {
  /** 1-based line number in the source file (header = 1). */
  line: number;
  status: RowStatus;
  problem?: string;
  title: string;
  date: string;
  amount: number;
  type: TxType | null;
  account: string;
  category: string;
  currency: string;
  note: string;
};

const cell = (row: string[], i: number) => (i >= 0 ? (row[i] ?? "").trim() : "");

/** Turn source rows into normalised rows the server will accept, with a reason when it would not. */
export function buildRows(data: string[][], m: Mapping): ReviewRow[] {
  return data.map((row, idx) => {
    const r: ReviewRow = {
      line: idx + 2,
      status: "ready",
      title: cell(row, m.title),
      date: "",
      amount: 0,
      type: null,
      account: m.account >= 0 ? cell(row, m.account) : m.fixedAccount.trim(),
      category: cell(row, m.category),
      currency: m.currency >= 0 ? cell(row, m.currency).toUpperCase() : m.fixedCurrency.trim().toUpperCase(),
      note: cell(row, m.note),
    };
    const fail = (problem: string) => { r.status = "invalid"; r.problem ??= problem; };

    const rawDate = cell(row, m.date);
    const d = rawDate ? parseDate(rawDate, m.dateFormat) : null;
    if (!rawDate) fail("No date");
    else if (!d) fail(`Date “${rawDate}” is not ${m.dateFormat}`);
    else r.date = d;

    if (m.amountMode === "debit-credit") {
      const debit = parseAmount(cell(row, m.debit)) ?? 0;
      const credit = parseAmount(cell(row, m.credit)) ?? 0;
      if (Math.abs(debit) > 0) { r.amount = Math.abs(debit); r.type = "expense"; }
      else if (Math.abs(credit) > 0) { r.amount = Math.abs(credit); r.type = "income"; }
      else fail("No debit or credit amount");
    } else {
      const rawAmt = cell(row, m.amount);
      const a = parseAmount(rawAmt);
      if (a === null || a === 0) fail(rawAmt ? `Amount “${rawAmt}” is not a number` : "No amount");
      else if (m.amountMode === "signed") { r.amount = Math.abs(a); r.type = a < 0 ? "expense" : "income"; }
      else {
        r.amount = Math.abs(a);
        const rawType = cell(row, m.type);
        r.type = parseType(rawType);
        if (!r.type) fail(rawType ? `Type “${rawType}” is not income, expense or transfer` : "No type");
      }
    }

    if (!r.title) fail("No description");
    if (!r.account) fail("No account");
    if (r.currency && !/^[A-Z]{3}$/.test(r.currency)) fail(`Currency “${r.currency}” is not a 3-letter code`);
    return r;
  });
}

/** Rewrite ready rows into the CSV shape POST /v1/import expects. */
export function toServerCsv(rows: ReviewRow[]): string {
  const header = ["title", "amount", "type", "date", "account", "currency", "category", "note"];
  const body = rows
    .filter((r) => r.status === "ready")
    .map((r) => [r.title, r.amount.toFixed(2), r.type ?? "", r.date, r.account, r.currency, r.category, r.note]);
  return toCsv([header, ...body]);
}

/** Fields that must be mapped before review, given the amount mode and account choice. */
export function missingFields(m: Mapping): string[] {
  const out: string[] = [];
  if (m.title < 0) out.push("Description");
  if (m.date < 0) out.push("Date");
  if (m.amountMode === "debit-credit") {
    if (m.debit < 0) out.push("Debit");
    if (m.credit < 0) out.push("Credit");
  } else {
    if (m.amount < 0) out.push("Amount");
    if (m.amountMode === "amount-type" && m.type < 0) out.push("Type");
  }
  if (m.account < 0 && !m.fixedAccount.trim()) out.push("Account");
  return out;
}
