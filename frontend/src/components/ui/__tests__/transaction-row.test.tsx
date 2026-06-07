import { describe, it, expect } from "vitest";
import { render, screen } from "@solidjs/testing-library";
import { TransactionRow } from "../transaction-row";
import { ShoppingCart } from "lucide-solid";
import "@testing-library/jest-dom/vitest";

describe("TransactionRow", () => {
  it("renders merchant, category, amount", () => {
    render(() => <TransactionRow icon={ShoppingCart} merchant="Whole Foods" category="Groceries" amount={-45} type="expense" date="2026-10-12" />);
    expect(screen.getByText("Whole Foods")).toBeInTheDocument();
    expect(screen.getByText("-₹45")).toBeInTheDocument();
  });
  it("shows + prefix and primary color for income", () => {
    render(() => <TransactionRow icon={ShoppingCart} merchant="Stripe" category="Income" amount={1250} type="income" date="2026-10-12" />);
    expect(screen.getByText("+₹1,250")).toHaveClass("text-primary");
  });
  it("renders a button when onClick is provided", () => {
    const { container } = render(() => <TransactionRow icon={ShoppingCart} merchant="x" category="x" amount={0} type="expense" date="2026-10-12" onClick={() => {}} />);
    expect(container.querySelector("button")).not.toBeNull();
  });
});
