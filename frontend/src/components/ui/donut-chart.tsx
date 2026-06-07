import { For, type Component } from "solid-js";
import { cn } from "../../lib/utils";

export type DonutSegment = { label: string; value: number; color?: string };

type ComputedStroke = { label: string; color: string; length: number; offset: number; dasharray: string };

const PALETTE = [
  "var(--color-primary)",
  "var(--color-text)",
  "var(--color-muted)",
  "var(--color-border-strong)",
  "#71717A",
];

export function computeSegmentStrokes(segments: DonutSegment[], radius: number): ComputedStroke[] {
  if (segments.length === 0) return [];
  const sorted = [...segments].sort((a, b) => b.value - a.value);
  const total = sorted.reduce((s, x) => s + x.value, 0);
  const circumference = 2 * Math.PI * radius;
  let offset = 0;
  return sorted.map((seg, i) => {
    const fraction = seg.value / total;
    const length = circumference * fraction;
    const color = seg.color ?? PALETTE[i % PALETTE.length];
    const dasharray = `${length.toFixed(2)} ${circumference.toFixed(2)}`;
    const stroke: ComputedStroke = { label: seg.label, color, length, offset: -offset, dasharray };
    offset += length;
    return stroke;
  });
}

type DonutChartProps = {
  segments: DonutSegment[];
  centerLabel?: string;
  centerValue?: string;
  centerTrend?: { dir: "up" | "down"; value: string; tone?: "primary" | "accent" };
  size?: number;
  thickness?: number;
  highlightIndex?: number | null;
  onSegmentHover?: (index: number | null) => void;
};

export const DonutChart: Component<DonutChartProps> = (props) => {
  const size = () => props.size ?? 280;
  const thickness = () => props.thickness ?? 32;
  const radius = () => (size() - thickness()) / 2;
  const strokes = () => computeSegmentStrokes(props.segments, radius());
  const isHighlighted = (i: number) => props.highlightIndex == null || props.highlightIndex === i;
  const a11yLabel = () => {
    const n = props.segments.length;
    const noun = n === 1 ? "category" : "categories";
    const label = props.centerLabel ?? "Donut chart";
    const value = props.centerValue ? ` ${props.centerValue}` : "";
    return `${label}${value} across ${n} ${noun}`;
  };

  return (
    <div class="relative flex items-center justify-center" style={{ width: `${size()}px`, height: `${size()}px` }} role="img" aria-label={a11yLabel()}>
      <svg class="absolute inset-0" width={size()} height={size()} viewBox={`0 0 ${size()} ${size()}`} style={{ transform: "rotate(-90deg)" }} aria-hidden="true">
        <circle cx={size() / 2} cy={size() / 2} r={radius()} fill="transparent" stroke="var(--color-surface-hover)" stroke-width={thickness()} />
        <For each={strokes()}>
          {(stroke, i) => (
            <circle class={cn("segment transition-opacity duration-150 motion-reduce:transition-none")}
              cx={size() / 2} cy={size() / 2} r={radius()} fill="transparent"
              stroke={stroke.color} stroke-width={thickness()}
              stroke-dasharray={stroke.dasharray} stroke-dashoffset={stroke.offset}
              opacity={isHighlighted(i()) ? 1 : 0.3}
              onMouseEnter={() => props.onSegmentHover?.(i())}
              onMouseLeave={() => props.onSegmentHover?.(null)} />
          )}
        </For>
      </svg>
      <div class="flex flex-col items-center z-10 text-center">
        {props.centerLabel && <span class="text-[13px] font-medium text-muted uppercase tracking-wider mb-1">{props.centerLabel}</span>}
        {props.centerValue && <span class="text-4xl font-display font-bold text-text leading-none">{props.centerValue}</span>}
        {props.centerTrend && (
          <span class={cn("inline-flex items-center gap-1 text-[13px] font-medium mt-2",
            props.centerTrend.tone === "accent" || props.centerTrend.dir === "down" ? "text-accent" : "text-primary")}>
            {props.centerTrend.dir === "up" ? "↑" : "↓"} {props.centerTrend.value}
          </span>
        )}
      </div>
      <table class="sr-only">
        <thead><tr><th>Category</th><th>Value</th></tr></thead>
        <tbody><For each={props.segments}>{(s) => <tr><td>{s.label}</td><td>{s.value}</td></tr>}</For></tbody>
      </table>
    </div>
  );
};
