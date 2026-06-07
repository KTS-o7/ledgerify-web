import { type JSX, splitProps, type Component } from "solid-js";
import { cn } from "../../lib/utils";

type Tone = "default" | "primary" | "accent";
type Size = "sm" | "md" | "lg" | "xl";
const sizeMap: Record<Size, string> = { sm: "text-base", md: "text-xl", lg: "text-3xl", xl: "text-5xl" };
const toneMap: Record<Tone, string> = { default: "text-text", primary: "text-primary", accent: "text-accent" };

type StatProps = JSX.HTMLAttributes<HTMLDivElement> & {
  label: string;
  value: string | number;
  trend?: { dir: "up" | "down" | "flat"; value: string };
  tone?: Tone;
  size?: Size;
  layout?: "vertical" | "inline";
};

export const Stat: Component<StatProps> = (props) => {
  const [local, others] = splitProps(props, ["label", "value", "trend", "tone", "size", "layout", "class"]);
  const layout = () => local.layout ?? "vertical";
  return (
    <div class={cn(layout() === "inline" ? "flex flex-row items-baseline justify-between" : "flex flex-col gap-1", local.class)} {...others}>
      <span class="text-[13px] font-body font-medium text-muted uppercase tracking-wide">{local.label}</span>
      <span class={cn("font-display font-bold tracking-tight", sizeMap[local.size ?? "md"], toneMap[local.tone ?? "default"])}>{local.value}</span>
      {local.trend && (
        <span class={cn("inline-flex items-center gap-1 text-sm font-medium",
          local.trend.dir === "up" ? "text-primary" : local.trend.dir === "down" ? "text-accent" : "text-muted")}>
          <span aria-hidden="true">{local.trend.dir === "up" ? "↑" : local.trend.dir === "down" ? "↓" : "→"}</span>
          <span>{local.trend.value}</span>
        </span>
      )}
    </div>
  );
};
