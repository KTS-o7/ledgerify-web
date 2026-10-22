import { type Component } from "solid-js";
import { cn } from "../../lib/utils";

type ProgressBarProps = {
  /** 0–100 (values above 100 mean overspend). */
  pct: number;
  class?: string;
  label?: string;
  /** Override the fill colour token, e.g. "bg-neg" for credit utilisation. */
  tone?: string;
};

/** 5px track in sunken; fill is signal, warn at ≥ 90%, neg above 100%. */
export const ProgressBar: Component<ProgressBarProps> = (props) => {
  const clamped = () => Math.max(0, Math.min(100, props.pct));
  const fill = () => props.tone ?? (props.pct > 100 ? "bg-neg" : props.pct >= 90 ? "bg-warn" : "bg-signal");
  return (
    <div
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(props.pct)}
      aria-label={props.label}
      class={cn("h-[5px] w-full rounded-pill bg-sunken overflow-hidden", props.class)}
    >
      <div
        class={cn("h-full rounded-pill transition-[width] duration-[800ms] ease-[var(--ease-standard)] motion-reduce:transition-none", fill())}
        style={{ width: `${clamped()}%` }}
      />
    </div>
  );
};
