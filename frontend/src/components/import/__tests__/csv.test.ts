import { describe, it, expect } from "vitest";
import { parseCsv, toCsv, guessMapping, parseDate, detectDateFormat, parseAmount, parseType, buildRows, toServerCsv, missingFields } from "../csv";

describe("parseCsv", () => {
  it("handles quotes, escaped quotes, CRLF, BOM and blank lines", () => {
    const rows = parseCsv('﻿a,b\r\n"x, y","say ""hi"""\r\n\r\n1,2');
    expect(rows).toEqual([["a", "b"], ["x, y", 'say "hi"'], ["1", "2"]]);
  });
  it("round-trips through toCsv", () => {
    const rows = [["a,b", 'q"q', "line\nbreak"]];
    expect(parseCsv(toCsv(rows))).toEqual(rows);
  });
});

describe("value parsing", () => {
  it("parses Indian and bracketed amounts", () => {
    expect(parseAmount("₹1,23,456.78")).toBeCloseTo(123456.78);
    expect(parseAmount("(500)")).toBe(-500);
    expect(parseAmount("-42")).toBe(-42);
    expect(parseAmount("1,200 Dr")).toBe(-1200);
    expect(parseAmount("abc")).toBeNull();
    expect(parseAmount("")).toBeNull();
  });
  it("parses dates per format and rejects impossible ones", () => {
    expect(parseDate("05/09/2026", "DD/MM/YYYY")).toBe("2026-09-05");
    expect(parseDate("05/09/2026", "MM/DD/YYYY")).toBe("2026-05-09");
    expect(parseDate("05-Sep-2026", "DD-MMM-YYYY")).toBe("2026-09-05");
    expect(parseDate("2026-09-05 10:30:00", "YYYY-MM-DD")).toBe("2026-09-05");
    expect(parseDate("31/02/2026", "DD/MM/YYYY")).toBeNull();
  });
  it("detects DD/MM before MM/DD, and MM/DD when the day is above 12", () => {
    expect(detectDateFormat(["01/02/2026", "03/04/2026"])).toBe("DD/MM/YYYY");
    expect(detectDateFormat(["01/25/2026"])).toBe("MM/DD/YYYY");
  });
  it("maps bank type spellings", () => {
    expect(parseType("DR")).toBe("expense");
    expect(parseType("Credit")).toBe("income");
    expect(parseType("transfer")).toBe("transfer");
    expect(parseType("refund")).toBeNull();
  });
});

describe("mapping and rows", () => {
  const headers = ["Txn Date", "Narration", "Withdrawal Amt.", "Deposit Amt.", "Ref No"];
  const data = [
    ["05/09/2026", "Swiggy", "450.00", "", "R1"],
    ["06/09/2026", "Salary", "", "1,20,000.00", "R2"],
    ["bad", "Nothing", "", "", "R3"],
  ];

  it("guesses a debit/credit statement", () => {
    const m = guessMapping(headers, data);
    expect(m.amountMode).toBe("debit-credit");
    expect([m.date, m.title, m.debit, m.credit, m.note]).toEqual([0, 1, 2, 3, 4]);
    expect(m.dateFormat).toBe("DD/MM/YYYY");
    expect(missingFields(m)).toEqual(["Account"]);
  });

  it("builds server rows and flags the bad one", () => {
    const m = { ...guessMapping(headers, data), fixedAccount: "HDFC" };
    const rows = buildRows(data, m);
    expect(rows[0]).toMatchObject({ status: "ready", type: "expense", amount: 450, date: "2026-09-05", account: "HDFC" });
    expect(rows[1]).toMatchObject({ status: "ready", type: "income", amount: 120000 });
    expect(rows[2]!.status).toBe("invalid");
    expect(rows[2]!.line).toBe(4);
    const csv = parseCsv(toServerCsv(rows));
    expect(csv[0]).toEqual(["title", "amount", "type", "date", "account", "currency", "category", "note"]);
    expect(csv).toHaveLength(3);
    expect(csv[1]).toEqual(["Swiggy", "450.00", "expense", "2026-09-05", "HDFC", "", "", "R1"]);
  });

  it("uses the sign in signed mode", () => {
    const m = { ...guessMapping(["date", "title", "amount", "account"], []), dateFormat: "YYYY-MM-DD" as const };
    expect(m.amountMode).toBe("signed");
    const rows = buildRows([["2026-09-01", "Rent", "-25000", "HDFC"]], m);
    expect(rows[0]).toMatchObject({ status: "ready", type: "expense", amount: 25000 });
  });
});
