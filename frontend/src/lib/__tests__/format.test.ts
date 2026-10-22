import { describe, it, expect, beforeEach } from "vitest";
import { compactMoney, formatCurrency, formatDate, formatDateGroup } from "../format";

describe("formatCurrency", () => {
  beforeEach(() => localStorage.clear());
  it("formats INR by default", () => { expect(formatCurrency(12450)).toBe("₹12,450"); });
  it("respects localStorage override", () => {
    localStorage.setItem("ledgerify.currency", "USD");
    expect(formatCurrency(12450)).toBe("$12,450");
  });
  it("handles negative amounts with prefix", () => { expect(formatCurrency(-84.2)).toBe("-₹84"); });
  it("handles zero", () => { expect(formatCurrency(0)).toBe("₹0"); });
});

describe("formatDate", () => {
  it("formats ISO date to short form", () => { expect(formatDate("2026-10-12")).toBe("Oct 12"); });
});

describe("formatDateGroup", () => {
  it("returns 'Today' for today's date", () => {
    const today = new Date().toISOString().slice(0, 10);
    expect(formatDateGroup(today)).toBe("Today");
  });
  it("returns 'Yesterday' for yesterday's date", () => {
    const y = new Date(); y.setDate(y.getDate() - 1);
    expect(formatDateGroup(y.toISOString().slice(0, 10))).toBe("Yesterday");
  });
  it("returns 'Mon DD' for older dates", () => { expect(formatDateGroup("2026-10-12")).toBe("Oct 12"); });
});

describe("compactMoney", () => {
  it("keeps full digits below one lakh", () => { expect(compactMoney(55138, "INR")).toBe("₹55,138"); });
  it("uses lakh and crore for INR", () => {
    expect(compactMoney(220000, "INR")).toBe("₹2.2L");
    expect(compactMoney(15000000, "INR")).toBe("₹1.5Cr");
  });
  it("uses K/M for other currencies", () => { expect(compactMoney(120000, "USD")).toBe("$120K"); });
  it("signs negatives with a minus", () => { expect(compactMoney(-3150, "INR")).toBe("−₹3,150"); });
});
