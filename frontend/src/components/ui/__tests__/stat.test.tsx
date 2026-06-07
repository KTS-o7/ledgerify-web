import { describe, it, expect } from "vitest";
import "@testing-library/jest-dom/vitest";
import { render, screen } from "@solidjs/testing-library";
import { Stat } from "../stat";
import { formatCurrency } from "../../../lib/format";

describe("Stat", () => {
  it("renders label and value", () => {
    render(() => <Stat label="Income" value="$4,200" />);
    expect(screen.getByText("Income")).toBeInTheDocument();
    expect(screen.getByText("$4,200")).toBeInTheDocument();
  });
  it("renders trend with up arrow", () => {
    render(() => <Stat label="x" value="1" trend={{ dir: "up", value: "+2.4%" }} />);
    expect(screen.getByText("+2.4%")).toBeInTheDocument();
  });
  it("uses display font for value", () => {
    render(() => <Stat label="x" value="42" size="lg" />);
    expect(screen.getByText("42")).toHaveClass("font-display");
  });
  it("renders inline layout", () => {
    const { container } = render(() => <Stat label="x" value="y" layout="inline" />);
    expect(container.firstChild as HTMLElement).toHaveClass("flex-row");
  });
  it("formats numeric value as currency when format=\"currency\"", () => {
    render(() => <Stat label="Balance" value={12450} format="currency" />);
    expect(screen.getByText(formatCurrency(12450))).toBeInTheDocument();
  });
});
