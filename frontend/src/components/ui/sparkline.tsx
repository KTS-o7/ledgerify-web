import { type Component } from "solid-js";
import { cn } from "../../lib/utils";

export function buildSparklinePath(values: number[], width: number, height: number): string {
  if (values.length === 0) return "";
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const stepX = values.length > 1 ? width / (values.length - 1) : 0;
  return values.map((v, i) => {
    const x = i * stepX;
    const y = height - ((v - min) / range) * height;
    return `${i === 0 ? "M" : "L"} ${x.toFixed(2)} ${y.toFixed(2)}`;
  }).join(" ");
}

type SparklineProps = {
  values: number[];
  width?: number;
  height?: number;
  tone?: "signal" | "text" | "muted" | "pos" | "neg";
  class?: string;
};

const toneMap = { signal: "var(--color-signal)", text: "var(--color-text)", muted: "var(--color-muted)", pos: "var(--color-pos)", neg: "var(--color-neg)" };

export const Sparkline: Component<SparklineProps> = (props) => {
  const width = () => props.width ?? 240;
  const height = () => props.height ?? 40;
  return (
    <svg class={cn("block", props.class)} width={width()} height={height()} viewBox={`0 0 ${width()} ${height()}`} preserveAspectRatio="none" role="img" aria-label="Trend sparkline">
      <path d={buildSparklinePath(props.values, width(), height())} fill="none" stroke={toneMap[props.tone ?? "signal"]} stroke-width="1.6" vector-effect="non-scaling-stroke" stroke-linecap="round" stroke-linejoin="round" />
    </svg>
  );
};
