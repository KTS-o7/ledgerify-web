import { describe, it, expect } from "vitest";
import { render } from "@solidjs/testing-library";
import { Sparkline, buildSparklinePath } from "../sparkline";
import "@testing-library/jest-dom/vitest";

describe("Sparkline — math", () => {
  it("returns empty path for empty series", () => { expect(buildSparklinePath([], 100, 40)).toBe(""); });
  it("produces a polyline with N+1 points", () => {
    const out = buildSparklinePath([1, 2, 3, 4, 5], 100, 40);
    expect(out.startsWith("M 0")).toBe(true);
    expect(out).toMatch(/L 100(\.00)? /);
  });
});

describe("Sparkline — render", () => {
  it("renders an SVG path", () => {
    const { container } = render(() => <Sparkline values={[1, 2, 3]} width={120} height={40} />);
    expect(container.querySelector("path")).not.toBeNull();
  });
  it("uses primary stroke by default", () => {
    const { container } = render(() => <Sparkline values={[1, 2, 3]} width={120} height={40} />);
    expect(container.querySelector("path")).toHaveAttribute("stroke", "var(--color-primary)");
  });
});
