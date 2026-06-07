import { createSignal, Show } from "solid-js";
import { api } from "../../lib/api";
import { Input } from "../ui/input";
import { Select } from "../ui/select";
import { Button } from "../ui/button";
import { SegmentedControl } from "../ui/segmented-control";

type PremiumFrequency = "monthly" | "quarterly" | "annual";

type InsuranceFormProps = {
  onSuccess: () => void;
  onClose: () => void;
};

const frequencyOptions: { value: PremiumFrequency; label: string }[] = [
  { value: "monthly", label: "Monthly" },
  { value: "quarterly", label: "Quarterly" },
  { value: "annual", label: "Annual" },
];

export function InsuranceForm(props: InsuranceFormProps) {
  const [policyName, setPolicyName] = createSignal("");
  const [policyType, setPolicyType] = createSignal("life");
  const [provider, setProvider] = createSignal("");
  const [premiumFrequency, setPremiumFrequency] = createSignal<PremiumFrequency>("annual");
  const [premiumAmount, setPremiumAmount] = createSignal("");
  const [coverageAmount, setCoverageAmount] = createSignal("");
  const [currency, setCurrency] = createSignal("INR");
  const [renewalDate, setRenewalDate] = createSignal("");

  const [submitting, setSubmitting] = createSignal(false);
  const [error, setError] = createSignal("");

  async function handleSubmit(e: Event) {
    e.preventDefault();
    setError("");

    if (!policyName().trim()) {
      setError("Policy name is required.");
      return;
    }

    setSubmitting(true);
    try {
      await api.post("/v1/insurance", {
        name: policyName().trim(),
        policy_type: policyType(),
        currency: currency(),
        premium_frequency: premiumFrequency(),
        ...(provider().trim() ? { provider: provider().trim() } : {}),
        ...(premiumAmount() !== "" ? { premium_amount: parseFloat(premiumAmount()) } : {}),
        ...(coverageAmount() !== "" ? { coverage_amount: parseFloat(coverageAmount()) } : {}),
        ...(renewalDate() ? { renewal_date: renewalDate() } : {}),
      });
      props.onSuccess();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to add insurance policy.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} class="flex flex-col gap-4">
      {/* Policy Name */}
      <div>
        <label for="ins-name" class="text-[13px] font-body font-medium text-muted uppercase tracking-wide mb-1.5 block">
          Policy Name
        </label>
        <Input
          id="ins-name"
          type="text"
          placeholder="e.g. LIC Term Plan"
          value={policyName()}
          onInput={(e) => setPolicyName(e.currentTarget.value)}
          required
        />
      </div>

      {/* Type */}
      <div>
        <label for="ins-type" class="text-[13px] font-body font-medium text-muted uppercase tracking-wide mb-1.5 block">
          Type
        </label>
        <Select
          id="ins-type"
          value={policyType()}
          onChange={(e) => setPolicyType(e.currentTarget.value)}
          required
        >
          <option value="life">Life</option>
          <option value="health">Health</option>
          <option value="vehicle">Vehicle</option>
          <option value="property">Property</option>
          <option value="term">Term</option>
          <option value="other">Other</option>
        </Select>
      </div>

      {/* Provider */}
      <div>
        <label for="ins-provider" class="text-[13px] font-body font-medium text-muted uppercase tracking-wide mb-1.5 block">
          Provider
        </label>
        <Input
          id="ins-provider"
          type="text"
          placeholder="e.g. LIC, HDFC Life"
          value={provider()}
          onInput={(e) => setProvider(e.currentTarget.value)}
        />
      </div>

      {/* Premium Frequency */}
      <div>
        <label class="text-[13px] font-body font-medium text-muted uppercase tracking-wide mb-1.5 block">
          Premium Frequency
        </label>
        <SegmentedControl
          options={frequencyOptions}
          value={premiumFrequency()}
          onChange={setPremiumFrequency}
          ariaLabel="Premium frequency"
        />
      </div>

      {/* Premium Amount */}
      <div>
        <label for="ins-premium-amount" class="text-[13px] font-body font-medium text-muted uppercase tracking-wide mb-1.5 block">
          Premium Amount
        </label>
        <Input
          id="ins-premium-amount"
          type="number"
          min="0"
          step="0.01"
          placeholder="0.00"
          value={premiumAmount()}
          onInput={(e) => setPremiumAmount(e.currentTarget.value)}
        />
      </div>

      {/* Coverage Amount */}
      <div>
        <label for="ins-coverage-amount" class="text-[13px] font-body font-medium text-muted uppercase tracking-wide mb-1.5 block">
          Coverage Amount
        </label>
        <Input
          id="ins-coverage-amount"
          type="number"
          min="0"
          step="0.01"
          placeholder="0.00"
          value={coverageAmount()}
          onInput={(e) => setCoverageAmount(e.currentTarget.value)}
        />
      </div>

      {/* Currency */}
      <div>
        <label for="ins-currency" class="text-[13px] font-body font-medium text-muted uppercase tracking-wide mb-1.5 block">
          Currency
        </label>
        <Select
          id="ins-currency"
          value={currency()}
          onChange={(e) => setCurrency(e.currentTarget.value)}
          required
        >
          <option value="INR">INR</option>
          <option value="USD">USD</option>
          <option value="EUR">EUR</option>
          <option value="GBP">GBP</option>
        </Select>
      </div>

      {/* Renewal Date */}
      <div>
        <label for="ins-renewal-date" class="text-[13px] font-body font-medium text-muted uppercase tracking-wide mb-1.5 block">
          Renewal Date
        </label>
        <Input
          id="ins-renewal-date"
          type="date"
          value={renewalDate()}
          onInput={(e) => setRenewalDate(e.currentTarget.value)}
        />
      </div>

      <Show when={error()}>
        <p class="text-accent text-sm">{error()}</p>
      </Show>

      <Button type="submit" class="w-full mt-2" disabled={submitting()}>
        {submitting() ? "Saving…" : "Save"}
      </Button>
    </form>
  );
}
