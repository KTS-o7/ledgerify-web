import { describe, it, expect } from "vitest";
import { render } from "@solidjs/testing-library";
import { DonutChart, computeSegmentStrokes } from "../donut-chart";
import "@testing-library/jest-dom/vitest";

describe("DonutChart — math", () => {
  it("computes strokes for a single segment (full ring)", () => {
    const out = computeSegmentStrokes([{ label: "x", value: 100 }], 124);
    expect(out).toHaveLength(1);
    expect(out[0].dasharray).toMatch(/779/);
  });
  it("splits 4 equal segments at 25% each", () => {
    const out = computeSegmentStrokes(
      [{ label: "a", value: 25 }, { label: "b", value: 25 }, { label: "c", value: 25 }, { label: "d", value: 25 }], 124);
    expect(out).toHaveLength(4);
    expect(out[0].dasharray).toBe("194.78 779.11");
  });
  it("returns sorted-by-value order with correct offsets", () => {
    const out = computeSegmentStrokes(
      [{ label: "small", value: 10 }, { label: "big", value: 60 }, { label: "mid", value: 30 }], 124);
    expect(out.map((s) => s.label)).toEqual(["big", "mid", "small"]);
    expect(out[1].offset).toBeCloseTo(-out[0].length, 2);
  });
  it("returns empty array for empty input", () => {
    expect(computeSegmentStrokes([], 124)).toEqual([]);
  });
});

describe("DonutChart — render", () => {
  it("renders an SVG with a circle per segment", () => {
    const { container } = render(() => <DonutChart segments={[{ label: "a", value: 50 }, { label: "b", value: 50 }]} centerValue="$100" centerLabel="Total" />);
    expect(container.querySelectorAll("circle").length).toBe(3);
  });
  it("renders the center label and value", () => {
    const { container } = render(() => <DonutChart segments={[{ label: "a", value: 100 }]} centerValue="$100" centerLabel="Total" />);
    expect(container.textContent).toContain("$100");
    expect(container.textContent).toContain("Total");
  });
  it("dims non-highlighted segments when highlightIndex is set", () => {
    const { container } = render(() => <DonutChart segments={[{ label: "a", value: 50 }, { label: "b", value: 50 }]} highlightIndex={0} />);
    const circles = container.querySelectorAll("circle.segment");
    expect(circles[0]).toHaveAttribute("opacity", "1");
    expect(circles[1]).toHaveAttribute("opacity", "0.3");
  });
});
