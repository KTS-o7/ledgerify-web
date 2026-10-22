import { describe, it, expect } from "vitest";
import { render, screen } from "@solidjs/testing-library";
import { AccountRow } from "../account-row";
import { Wallet } from "lucide-solid";
import "@testing-library/jest-dom/vitest";

describe("AccountRow", () => {
  it("renders name, sublabel, formatted balance", () => {
    const { container } = render(() => <AccountRow icon={Wallet} name="Chase" sublabel="•••• 1234" balance={12450} />);
    expect(screen.getByText("Chase")).toBeInTheDocument();
    expect(container.querySelector(".font-mono")?.textContent).toBe("₹12,450");
  });
  it("uses rupee by default", () => {
    const { container } = render(() => <AccountRow icon={Wallet} name="x" balance={100} />);
    expect(container.querySelector(".font-mono")?.textContent).toBe("₹100");
  });
  it("renders a button when onClick is provided", () => {
    const { container } = render(() => <AccountRow icon={Wallet} name="x" balance={0} onClick={() => {}} />);
    expect(container.querySelector("button")).not.toBeNull();
  });
  it("shows 'Sync failed' badge on error status", () => {
    render(() => <AccountRow icon={Wallet} name="x" balance={0} status="error" />);
    expect(screen.getByText("Sync failed")).toBeInTheDocument();
  });
});

describe("AccountRow negative balance", () => {
  it("renders negative balances in the debt colour", () => {
    const { container } = render(() => <AccountRow icon={Wallet} name="Card" balance={-500} />);
    expect(container.querySelector(".font-mono")).toHaveClass("text-neg");
    expect(container.querySelector(".font-mono")?.textContent).toBe("−₹500");
  });
});
