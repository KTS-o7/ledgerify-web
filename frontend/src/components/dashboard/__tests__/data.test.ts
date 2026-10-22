import { describe, it, expect } from "vitest";
import { deriveNetWorth, lastMonths, sliceRange, snapshotSeries, categoryColor, toRow } from "../data";

describe("dashboard data", () => {
  it("zero-fills months with no transactions", () => {
    const out = lastMonths([{ date: "2026-09", total_balance: 100, income: 300, expense: 200 }], "2026-10", 3);
    expect(out.map((m) => m.month)).toEqual(["2026-08", "2026-09", "2026-10"]);
    expect(out[0]).toMatchObject({ income: 0, expense: 0, net: 0 });
    expect(out[1]).toMatchObject({ income: 300, expense: 200, net: 100 });
  });

  it("walks net worth back from today using later months' net flow", () => {
    const flows = [
      { date: "2026-08", total_balance: 50 },
      { date: "2026-09", total_balance: 100 },
      { date: "2026-10", total_balance: -30 },
    ];
    const pts = deriveNetWorth(1000, flows, "2026-10", 3);
    expect(pts).toEqual([
      { month: "2026-08", value: 930 },
      { month: "2026-09", value: 1030 },
      { month: "2026-10", value: 1000 },
    ]);
  });

  it("keeps one snapshot per month, the latest", () => {
    const pts = snapshotSeries([
      { id: "a", as_of: "2026-09-30", currency: "INR", networth: 2 },
      { id: "b", as_of: "2026-09-01", currency: "INR", networth: 1 },
      { id: "c", as_of: "2026-10-05", currency: "INR", networth: 3 },
    ]);
    expect(pts).toEqual([{ month: "2026-09", value: 2 }, { month: "2026-10", value: 3 }]);
  });

  it("slices ranges including the starting month", () => {
    const pts = Array.from({ length: 20 }, (_, i) => ({ month: `m${i}`, value: i }));
    expect(sliceRange(pts, "3M")).toHaveLength(4);
    expect(sliceRange(pts, "1Y")).toHaveLength(13);
    expect(sliceRange(pts, "ALL")).toHaveLength(20);
  });

  it("maps categories onto the six category tokens, stably", () => {
    expect(categoryColor("Dining")).toMatch(/^var\(--color-cat-[1-6]\)$/);
    expect(categoryColor("Dining")).toBe(categoryColor("Dining"));
  });

  it("normalises pgtype fields from the summary", () => {
    const r = toRow({
      id: "x", date: "2026-10-12", title: { String: "Cafe", Valid: true }, account_name: "HDFC",
      category_name: { String: "", Valid: false }, amount: -45, type: "expense", parent_recurring_id: "r1",
    });
    expect(r).toMatchObject({ title: "Cafe", category: "Uncategorized", amount: 45, recurring: true, date: "2026-10-12" });
  });
});
