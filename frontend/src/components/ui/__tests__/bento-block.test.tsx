import { describe, it, expect } from "vitest";
import "@testing-library/jest-dom/vitest";
import { render, screen } from "@solidjs/testing-library";
import { BentoBlock } from "../bento-block";

describe("BentoBlock", () => {
  it("renders children", () => {
    render(() => <BentoBlock>hello</BentoBlock>);
    expect(screen.getByText("hello")).toBeInTheDocument();
  });
  it("applies surface, radius, and border by default", () => {
    const { container } = render(() => <BentoBlock>x</BentoBlock>);
    const el = container.firstChild as HTMLElement;
    expect(el).toHaveClass("bg-surface");
    expect(el).toHaveClass("rounded-[24px]");
    expect(el).toHaveClass("border");
    expect(el).toHaveClass("border-border");
  });
  it("scales on press when variant is pressable", () => {
    const { container } = render(() => <BentoBlock variant="pressable">x</BentoBlock>);
    const el = container.firstChild as HTMLElement;
    expect(el).toHaveClass("active:scale-[0.96]");
    expect(el).toHaveClass("cursor-pointer");
  });
  it("uses dashed border for dashed variant", () => {
    const { container } = render(() => <BentoBlock variant="dashed">x</BentoBlock>);
    const el = container.firstChild as HTMLElement;
    expect(el).toHaveClass("border-dashed");
    expect(el).toHaveClass("bg-transparent");
  });
});
