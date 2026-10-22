import { describe, it, expect } from "vitest";
import { paceSummary, periodElapsed, daysLeftInMonth, pctChange } from "../budget-math";

const oct10 = new Date(2026, 9, 10); // Saturday, 10 Oct 2026; October has 31 days

describe("budget-math", () => {
  it("monthly elapsed counts today", () => {
    expect(periodElapsed("monthly", oct10)).toBeCloseTo(10 / 31);
  });
  it("weekly elapsed starts on Monday", () => {
    expect(periodElapsed("weekly", oct10)).toBeCloseTo(6 / 7);
  });
  it("days left excludes today", () => {
    expect(daysLeftInMonth(oct10)).toBe(21);
  });
  it("flags spending ahead of pace", () => {
    const s = paceSummary([{ amount: 3100, spent: 2000, period_type: "monthly", currency: "INR" }], oct10);
    expect(s.expected).toBeCloseTo(1000);
    expect(s.delta).toBeCloseTo(1000);
    expect(s.remaining).toBe(1100);
  });
  it("is under pace when spending lags the calendar", () => {
    const s = paceSummary([{ amount: 3100, spent: 500, period_type: "monthly", currency: "INR" }], oct10);
    expect(s.delta).toBeLessThan(0);
  });
  it("pctChange has no baseline for zero", () => {
    expect(pctChange(100, 0)).toBeNull();
    expect(pctChange(92, 100)).toBeCloseTo(-8);
  });
});
