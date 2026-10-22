import { type Component, splitProps, type JSX } from "solid-js";
import { cn } from "../../lib/utils";
import { getCurrency } from "../../lib/format";

export type MoneyTone = "text" | "muted" | "pos" | "neg" | "signal" | "auto";

type MoneyProps = JSX.HTMLAttributes<HTMLSpanElement> & {
  value: number;
  currency?: string;
  /** "auto" = pos when > 0, neg when < 0. Expenses should stay "text". */
  tone?: MoneyTone;
  /** Show an explicit + or − sign. */
  signed?: boolean;
  /** Render the currency symbol muted (hero values). */
  mutedSymbol?: boolean;
  /** Fraction digits; defaults to 0. */
  digits?: number;
};

const toneClass: Record<Exclude<MoneyTone, "auto">, string> = {
  text: "text-text", muted: "text-muted", pos: "text-pos", neg: "text-neg", signal: "text-signal",
};

/** Split an amount into its symbol and digits so the symbol can be styled. */
export function moneyParts(value: number, currency = getCurrency(), digits = 0): { symbol: string; number: string } {
  const parts = new Intl.NumberFormat("en-IN", {
    style: "currency", currency, minimumFractionDigits: digits, maximumFractionDigits: digits,
  }).formatToParts(Math.abs(value));
  const symbol = parts.filter((p) => p.type === "currency").map((p) => p.value).join("");
  const number = parts.filter((p) => p.type !== "currency" && p.type !== "literal").map((p) => p.value).join("");
  return { symbol, number };
}

/** Every amount: Geist Mono, tabular figures, signed tone. */
export const Money: Component<MoneyProps> = (props) => {
  const [local, others] = splitProps(props, ["value", "currency", "tone", "signed", "mutedSymbol", "digits", "class"]);
  const parts = () => moneyParts(local.value, local.currency, local.digits ?? 0);
  const sign = () => (local.value < 0 ? "−" : local.signed && local.value > 0 ? "+" : "");
  const tone = () => {
    const t = local.tone ?? "text";
    if (t !== "auto") return toneClass[t];
    return local.value > 0 ? toneClass.pos : local.value < 0 ? toneClass.neg : toneClass.text;
  };
  return (
    <span class={cn("font-mono tabular whitespace-nowrap", tone(), local.class)} {...others}>
      {sign()}
      <span class={local.mutedSymbol ? "text-muted font-normal" : undefined}>{parts().symbol}</span>
      {parts().number}
    </span>
  );
};
