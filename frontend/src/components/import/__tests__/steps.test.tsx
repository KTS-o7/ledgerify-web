import { describe, it, expect } from "vitest";
import { render, screen, fireEvent } from "@solidjs/testing-library";
import "@testing-library/jest-dom/vitest";
import { MapStep } from "../MapStep";
import { ReviewStep } from "../ReviewStep";
import { StepPills } from "../StepPills";
import { guessMapping, buildRows } from "../csv";

const headers = ["Date", "Narration", "Debit", "Credit"];
const data = [["05/09/2026", "Swiggy", "450", ""], ["06/09/2026", "Salary", "", "1000"], ["x", "", "", ""]];

describe("MapStep", () => {
  it("asks for the account when no column holds it", () => {
    const m = guessMapping(headers, data);
    render(() => <MapStep fileName="s.csv" headers={headers} data={data} mapping={m} onChange={() => {}} accounts={[{ id: "1", name: "HDFC", currency: "INR" }]} onBack={() => {}} onNext={() => {}} />);
    expect(screen.getByText(/Still needed: Account/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Review rows/ })).toBeDisabled();
  });
});

describe("ReviewStep", () => {
  it("counts ready and invalid rows and filters", () => {
    const rows = buildRows(data, { ...guessMapping(headers, data), fixedAccount: "HDFC" });
    render(() => <ReviewStep rows={rows} categoryNames={new Set()} accountNames={new Set(["HDFC"])} onBack={() => {}} onImport={() => {}} />);
    expect(screen.getByRole("button", { name: /Import 2/ })).toBeEnabled();
    fireEvent.click(screen.getByRole("button", { name: /Needs attention/ }));
    expect(screen.getAllByText(/is not DD\/MM\/YYYY/).length).toBeGreaterThan(0);
  });
});

describe("StepPills", () => {
  it("marks the current step", () => {
    render(() => <StepPills step={2} reachable={2} onSelect={() => {}} />);
    expect(screen.getByRole("button", { current: "step" })).toHaveTextContent("Map columns");
  });
});
