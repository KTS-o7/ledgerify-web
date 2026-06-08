import { createSignal, Show } from "solid-js";
import { api } from "../../lib/api";
import { Input } from "../ui/input";
import { Select } from "../ui/select";
import { Button } from "../ui/button";

type SipFormProps = {
  onSuccess: () => void;
  onClose: () => void;
};

export function SipForm(props: SipFormProps) {
  const [name, setName] = createSignal("");
  const [sipType, setSipType] = createSignal("equity");
  const [currency, setCurrency] = createSignal("INR");
  const [monthlyAmount, setMonthlyAmount] = createSignal("");
  const [startDate, setStartDate] = createSignal("");
  const [expectedReturn, setExpectedReturn] = createSignal("");
  const [currentNav, setCurrentNav] = createSignal("");
  const [unitsAccumulated, setUnitsAccumulated] = createSignal("");

  const [submitting, setSubmitting] = createSignal(false);
  const [error, setError] = createSignal("");

  async function handleSubmit(e: Event) {
    e.preventDefault();
    setError("");

    if (!name().trim()) {
      setError("Name is required.");
      return;
    }
    if (!monthlyAmount() || parseFloat(monthlyAmount()) <= 0) {
      setError("Monthly amount is required.");
      return;
    }
    if (!startDate()) {
      setError("Start date is required.");
      return;
    }

    setSubmitting(true);
    try {
      await api.post("/v1/sips", {
        name: name().trim(),
        sip_type: sipType(),
        currency: currency(),
        monthly_amount: parseFloat(monthlyAmount()),
        start_date: startDate(),
        ...(expectedReturn() !== "" ? { expected_return_rate: parseFloat(expectedReturn()) } : {}),
        ...(currentNav() !== "" ? { current_nav: parseFloat(currentNav()) } : {}),
        ...(unitsAccumulated() !== "" ? { units_accumulated: parseFloat(unitsAccumulated()) } : {}),
      });
      props.onSuccess();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to add SIP.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} class="flex flex-col gap-4">
      <div>
        <label for="sip-name" class="text-[13px] font-body font-medium text-muted uppercase tracking-wide mb-1.5 block">
          Name
        </label>
        <Input
          id="sip-name"
          type="text"
          placeholder="e.g. Nifty 50 Index Fund SIP"
          value={name()}
          onInput={(e) => setName(e.currentTarget.value)}
          required
        />
      </div>

      <div>
        <label for="sip-type" class="text-[13px] font-body font-medium text-muted uppercase tracking-wide mb-1.5 block">
          SIP Type
        </label>
        <Select
          id="sip-type"
          value={sipType()}
          onChange={(e) => setSipType(e.currentTarget.value)}
        >
          <option value="equity">Equity</option>
          <option value="debt">Debt</option>
          <option value="hybrid">Hybrid</option>
          <option value="other">Other</option>
        </Select>
      </div>

      <div>
        <label for="sip-currency" class="text-[13px] font-body font-medium text-muted uppercase tracking-wide mb-1.5 block">
          Currency
        </label>
        <Select
          id="sip-currency"
          value={currency()}
          onChange={(e) => setCurrency(e.currentTarget.value)}
        >
          <option value="INR">INR</option>
          <option value="USD">USD</option>
          <option value="EUR">EUR</option>
          <option value="GBP">GBP</option>
        </Select>
      </div>

      <div>
        <label for="sip-monthly-amount" class="text-[13px] font-body font-medium text-muted uppercase tracking-wide mb-1.5 block">
          Monthly Amount
        </label>
        <Input
          id="sip-monthly-amount"
          type="number"
          min="0"
          step="0.01"
          placeholder="0.00"
          value={monthlyAmount()}
          onInput={(e) => setMonthlyAmount(e.currentTarget.value)}
          required
        />
      </div>

      <div>
        <label for="sip-start-date" class="text-[13px] font-body font-medium text-muted uppercase tracking-wide mb-1.5 block">
          Start Date
        </label>
        <Input
          id="sip-start-date"
          type="date"
          value={startDate()}
          onInput={(e) => setStartDate(e.currentTarget.value)}
          required
        />
      </div>

      <Show when={sipType() === "debt" || sipType() === "hybrid" || sipType() === "other"}>
        <div>
          <label for="sip-expected-return" class="text-[13px] font-body font-medium text-muted uppercase tracking-wide mb-1.5 block">
            Expected Return Rate (% p.a.)
          </label>
          <Input
            id="sip-expected-return"
            type="number"
            min="0"
            step="0.01"
            placeholder="e.g. 7.5"
            value={expectedReturn()}
            onInput={(e) => setExpectedReturn(e.currentTarget.value)}
          />
        </div>
      </Show>

      <Show when={sipType() === "equity"}>
        <div>
          <label for="sip-current-nav" class="text-[13px] font-body font-medium text-muted uppercase tracking-wide mb-1.5 block">
            Current NAV (per unit)
          </label>
          <Input
            id="sip-current-nav"
            type="number"
            min="0"
            step="0.0001"
            placeholder="0.0000"
            value={currentNav()}
            onInput={(e) => setCurrentNav(e.currentTarget.value)}
          />
        </div>
        <div>
          <label for="sip-units-accumulated" class="text-[13px] font-body font-medium text-muted uppercase tracking-wide mb-1.5 block">
            Units Accumulated
          </label>
          <Input
            id="sip-units-accumulated"
            type="number"
            min="0"
            step="0.00000001"
            placeholder="0"
            value={unitsAccumulated()}
            onInput={(e) => setUnitsAccumulated(e.currentTarget.value)}
          />
        </div>
      </Show>

      <Show when={error()}>
        <p class="text-accent text-sm">{error()}</p>
      </Show>

      <Button type="submit" class="w-full mt-2" disabled={submitting()}>
        {submitting() ? "Saving…" : "Save"}
      </Button>
    </form>
  );
}
