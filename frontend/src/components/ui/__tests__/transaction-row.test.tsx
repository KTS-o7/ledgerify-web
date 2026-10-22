import { describe, it, expect } from "vitest";
import { render, screen } from "@solidjs/testing-library";
import { TransactionRow } from "../transaction-row";
import { ShoppingCart } from "lucide-solid";
import "@testing-library/jest-dom/vitest";

describe("TransactionRow", () => {
  it("renders merchant, category and a signed amount", () => {
    const { container } = render(() => <TransactionRow icon={ShoppingCart} merchant="Whole Foods" category="Groceries" amount={-45} type="expense" date="2026-10-12" />);
    expect(screen.getByText("Whole Foods")).toBeInTheDocument();
    expect(container.textContent).toContain("−₹45");
  });
  it("keeps expenses in text colour, not the debt colour", () => {
    const { container } = render(() => <TransactionRow icon={ShoppingCart} merchant="x" category="x" amount={45} type="expense" date="2026-10-12" />);
    expect(container.querySelector(".font-mono.text-text")).not.toBeNull();
    expect(container.querySelector(".text-neg")).toBeNull();
  });
  it("shows + prefix and pos colour for income", () => {
    const { container } = render(() => <TransactionRow icon={ShoppingCart} merchant="Stripe" category="Income" amount={1250} type="income" date="2026-10-12" />);
    expect(container.textContent).toContain("+₹1,250");
    expect(container.querySelector(".text-pos")).not.toBeNull();
  });
  it("is keyboard-activatable when onClick is provided", () => {
    const { container } = render(() => <TransactionRow icon={ShoppingCart} merchant="x" category="x" amount={0} type="expense" date="2026-10-12" onClick={() => {}} />);
    expect(container.querySelector("[role='button'][tabindex='0']")).not.toBeNull();
  });
  it("marks queued rows as waiting to sync", () => {
    render(() => <TransactionRow icon={ShoppingCart} merchant="x" category="x" amount={10} type="expense" date="2026-10-12" pending />);
    expect(screen.getByText("Waiting to sync")).toHaveClass("text-warn");
  });
});
