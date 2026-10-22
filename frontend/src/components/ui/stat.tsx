import { type JSX, splitProps, type Component } from "solid-js";
import { cn } from "../../lib/utils";
import { formatCurrency } from "../../lib/format";

type Tone = "default" | "signal" | "pos" | "neg" | "warn";
type Size = "sm" | "md" | "lg" | "xl";
type Format = "currency" | "percent" | "number" | "raw";
const sizeMap: Record<Size, string> = { sm: "text-[15px]", md: "text-[21px]", lg: "text-[30px]", xl: "text-[38px] md:text-[46px]" };
const toneMap: Record<Tone, string> = { default: "text-text", signal: "text-signal", pos: "text-pos", neg: "text-neg", warn: "text-warn" };
const numberFmt = new Intl.NumberFormat("en-IN");

function formatValue(value: string | number, format?: Format): string {
  if (format === undefined || format === "raw") return String(value);
  if (typeof value !== "number") return value;
  if (format === "currency") return formatCurrency(value);
  if (format === "percent") return `${value}%`;
  if (format === "number") return numberFmt.format(value);
  return String(value);
}

type StatProps = JSX.HTMLAttributes<HTMLDivElement> & {
  label: string;
  value: string | number;
  trend?: { dir: "up" | "down" | "flat"; value: string };
  tone?: Tone;
  size?: Size;
  layout?: "vertical" | "inline";
  format?: Format;
};

/** Mono eyebrow + mono tabular value. */
export const Stat: Component<StatProps> = (props) => {
  const [local, others] = splitProps(props, ["label", "value", "trend", "tone", "size", "layout", "format", "class"]);
  const layout = () => local.layout ?? "vertical";
  return (
    <div class={cn(layout() === "inline" ? "flex flex-row items-baseline justify-between" : "flex flex-col gap-1.5", local.class)} {...others}>
      <span class="font-mono font-medium text-[11px] uppercase tracking-[0.1em] text-muted">{local.label}</span>
      <span class={cn("font-mono font-normal tabular tracking-[-0.03em] leading-none", sizeMap[local.size ?? "md"], toneMap[local.tone ?? "default"])}>{formatValue(local.value, local.format)}</span>
      {local.trend && (
        <span class={cn("inline-flex items-center gap-1 font-mono text-[12px] tabular",
          local.trend.dir === "up" ? "text-pos" : local.trend.dir === "down" ? "text-neg" : "text-muted")}>
          <span aria-hidden="true">{local.trend.dir === "up" ? "↑" : local.trend.dir === "down" ? "↓" : "→"}</span>
          <span>{local.trend.value}</span>
        </span>
      )}
    </div>
  );
};
