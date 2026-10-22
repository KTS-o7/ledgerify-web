import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@solidjs/testing-library";
import "@testing-library/jest-dom/vitest";

vi.mock("../../../lib/api", () => ({
  api: {
    get: vi.fn(async (path: string) => (path === "/v1/accounts" ? [{ id: "a1", name: "HDFC", type: "bank", currency: "INR" }] : [])),
    post: vi.fn(async () => ({ queued: true })),
    put: vi.fn(),
  },
}));

import { TransactionForm } from "../../forms/transaction-form";
import { api } from "../../../lib/api";

describe("TransactionForm quick add", () => {
  afterEach(cleanup);
  it("labels the submit button by type", () => {
    render(() => <TransactionForm initialType="income" onSuccess={() => {}} onClose={() => {}} />);
    expect(screen.getByRole("button", { name: "Save income" })).toBeInTheDocument();
  });

  it("keeps the amount a clean decimal and groups the display", () => {
    const { container } = render(() => <TransactionForm onSuccess={() => {}} onClose={() => {}} />);
    const input = screen.getByLabelText("Amount in INR") as HTMLInputElement;
    fireEvent.input(input, { target: { value: "12a3456.789" } });
    expect(input.value).toBe("123456.78");
    expect(container.textContent).toContain("1,23,456.78");
  });

  it("treats a queued (offline) save as success", async () => {
    const onSuccess = vi.fn();
    render(() => <TransactionForm onSuccess={onSuccess} onClose={() => {}} />);
    await screen.findByRole("option", { name: "HDFC" });
    fireEvent.input(screen.getByLabelText("Amount in INR"), { target: { value: "420" } });
    fireEvent.change(screen.getByLabelText("Account"), { target: { value: "a1" } });
    fireEvent.submit(screen.getByRole("button", { name: "Save expense" }).closest("form")!);
    await vi.waitFor(() => expect(onSuccess).toHaveBeenCalled());
    expect(api.post).toHaveBeenCalledWith("/v1/transactions", expect.objectContaining({ amount: 420, type: "expense", account_id: "a1" }));
  });
});
