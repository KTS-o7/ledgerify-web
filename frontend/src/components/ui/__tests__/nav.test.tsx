import { describe, it, expect } from "vitest";
import { navGroups, mobileTabs, allNavItems } from "../nav-items";
import "@testing-library/jest-dom/vitest";

describe("nav-items", () => {
  it("groups the sidebar into Overview, Plan, Wealth, Tools", () => {
    expect(navGroups.map((g) => g.label)).toEqual(["Overview", "Plan", "Wealth", "Tools"]);
  });
  it("has 4 mobile tabs around the centre quick-add", () => {
    expect(mobileTabs.map((t) => t.label)).toEqual(["Home", "Activity", "Insights", "Wealth"]);
  });
  it("has unique G shortcuts", () => {
    const keys = allNavItems.map((i) => i.go).filter(Boolean);
    expect(new Set(keys).size).toBe(keys.length);
  });
  it("every item has a path, label and icon", () => {
    for (const item of allNavItems) {
      expect(item.path.startsWith("/")).toBe(true);
      expect(item.label).toBeTypeOf("string");
      expect(item.icon).toBeDefined();
    }
  });
});
