import { describe, it, expect } from "vitest";
import { nextDebit } from "../sip";
import { pct, paymentTone } from "../common";

describe("nextDebit", () => {
  const today = new Date(2026, 9, 22); // 22 Oct 2026
  it("returns this month's debit when the day is still ahead", () => {
    expect(nextDebit("2024-03-25", today)).toBe("2026-10-25");
  });
  it("rolls to next month when the day has passed", () => {
    expect(nextDebit("2024-03-05", today)).toBe("2026-11-05");
  });
  it("clamps to the last day of short months", () => {
    expect(nextDebit("2024-01-31", new Date(2026, 10, 15))).toBe("2026-11-30");
  });
  it("returns the start date when it is in the future", () => {
    expect(nextDebit("2027-01-10", today)).toBe("2027-01-10");
  });
  it("handles pgtype.Date objects and nulls", () => {
    expect(nextDebit({ Time: "2024-03-25T00:00:00Z", Valid: true }, today)).toBe("2026-10-25");
    expect(nextDebit(null, today)).toBeNull();
  });
});

describe("pct", () => {
  it("signs with a real minus", () => {
    expect(pct(12.345)).toBe("+12.3%");
    expect(pct(-3.21, 2)).toBe("−3.21%");
    expect(pct(0)).toBe("0.0%");
  });
});

describe("paymentTone", () => {
  it("maps statuses to tokens", () => {
    expect(paymentTone("paid")).toBe("text-pos");
    expect(paymentTone("missed")).toBe("text-neg");
    expect(paymentTone("due")).toBe("text-warn");
  });
});
