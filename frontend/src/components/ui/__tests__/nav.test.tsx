import { describe, it, expect } from "vitest";
import { primaryNavItems, secondaryNavItems } from "../nav-items";
import "@testing-library/jest-dom/vitest";

describe("nav-items", () => {
  it("has 4 primary items", () => {
    expect(primaryNavItems).toHaveLength(4);
  });
  it("has 9 secondary items", () => {
    expect(secondaryNavItems).toHaveLength(9);
  });
  it("every primary item has path, label, icon, section=primary", () => {
    for (const item of primaryNavItems) {
      expect(item.path).toBeTypeOf("string");
      expect(item.label).toBeTypeOf("string");
      expect(item.icon).toBeDefined();
      expect(item.section).toBe("primary");
    }
  });
  it("every secondary item has path, label, icon, section=secondary", () => {
    for (const item of secondaryNavItems) {
      expect(item.path).toBeTypeOf("string");
      expect(item.label).toBeTypeOf("string");
      expect(item.icon).toBeDefined();
      expect(item.section).toBe("secondary");
    }
  });
});
