import { createSignal, Show } from "solid-js";
import { api } from "../../lib/api";
import { Input } from "../ui/input";
import { Select } from "../ui/select";
import { Button } from "../ui/button";

type InvestmentFormProps = {
  onSuccess: () => void;
  onClose: () => void;
};

export function InvestmentForm(props: InvestmentFormProps) {
  const [name, setName] = createSignal("");
  const [assetType, setAssetType] = createSignal("stock");
  const [currency, setCurrency] = createSignal("INR");
  const [quantity, setQuantity] = createSignal("");
  const [buyPrice, setBuyPrice] = createSignal("");
  const [currentPrice, setCurrentPrice] = createSignal("");

  const [submitting, setSubmitting] = createSignal(false);
  const [error, setError] = createSignal("");

  async function handleSubmit(e: Event) {
    e.preventDefault();
    setError("");

    if (!name().trim()) {
      setError("Name is required.");
      return;
    }

    setSubmitting(true);
    try {
      await api.post("/v1/investments", {
        name: name().trim(),
        asset_type: assetType(),
        currency: currency(),
        ...(quantity() !== "" ? { quantity: parseFloat(quantity()) } : {}),
        ...(buyPrice() !== "" ? { buy_price: parseFloat(buyPrice()) } : {}),
        ...(currentPrice() !== "" ? { current_price: parseFloat(currentPrice()) } : {}),
      });
      props.onSuccess();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to add investment.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} class="flex flex-col gap-4">
      {/* Name */}
      <div>
        <label for="inv-name" class="text-[13px] font-body font-medium text-muted uppercase tracking-wide mb-1.5 block">
          Name
        </label>
        <Input
          id="inv-name"
          type="text"
          placeholder="e.g. HDFC Nifty 50 Index Fund"
          value={name()}
          onInput={(e) => setName(e.currentTarget.value)}
          required
        />
      </div>

      {/* Asset Type */}
      <div>
        <label for="inv-asset-type" class="text-[13px] font-body font-medium text-muted uppercase tracking-wide mb-1.5 block">
          Asset Type
        </label>
        <Select
          id="inv-asset-type"
          value={assetType()}
          onChange={(e) => setAssetType(e.currentTarget.value)}
          required
        >
          <option value="stock">Stock</option>
          <option value="mf">Mutual Fund</option>
          <option value="crypto">Crypto</option>
          <option value="fd">Fixed Deposit</option>
          <option value="ppf">PPF</option>
          <option value="nps">NPS</option>
          <option value="gold">Gold</option>
          <option value="silver">Silver</option>
          <option value="real_estate">Real Estate</option>
          <option value="savings">Savings</option>
          <option value="other">Other</option>
        </Select>
      </div>

      {/* Currency */}
      <div>
        <label for="inv-currency" class="text-[13px] font-body font-medium text-muted uppercase tracking-wide mb-1.5 block">
          Currency
        </label>
        <Select
          id="inv-currency"
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

      {/* Quantity */}
      <div>
        <label for="inv-quantity" class="text-[13px] font-body font-medium text-muted uppercase tracking-wide mb-1.5 block">
          Quantity
        </label>
        <Input
          id="inv-quantity"
          type="number"
          min="0"
          step="any"
          placeholder="0"
          value={quantity()}
          onInput={(e) => setQuantity(e.currentTarget.value)}
        />
      </div>

      {/* Buy Price */}
      <div>
        <label for="inv-buy-price" class="text-[13px] font-body font-medium text-muted uppercase tracking-wide mb-1.5 block">
          Buy Price
        </label>
        <Input
          id="inv-buy-price"
          type="number"
          min="0"
          step="0.01"
          placeholder="0.00"
          value={buyPrice()}
          onInput={(e) => setBuyPrice(e.currentTarget.value)}
        />
      </div>

      {/* Current Price */}
      <div>
        <label for="inv-current-price" class="text-[13px] font-body font-medium text-muted uppercase tracking-wide mb-1.5 block">
          Current Price
        </label>
        <Input
          id="inv-current-price"
          type="number"
          min="0"
          step="0.01"
          placeholder="0.00"
          value={currentPrice()}
          onInput={(e) => setCurrentPrice(e.currentTarget.value)}
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
