import { For, type Component } from "solid-js";
import { cn } from "../../lib/utils";

export type DonutSegment = { label: string; value: number; color?: string };

type ComputedStroke = { label: string; color: string; length: number; offset: number; dasharray: string };

export const CATEGORY_PALETTE = [
  "var(--color-cat-1)",
  "var(--color-cat-2)",
  "var(--color-cat-3)",
  "var(--color-cat-4)",
  "var(--color-cat-5)",
  "var(--color-cat-6)",
];

/** `gap` is the visible space (px along the ring) between segments. */
export function computeSegmentStrokes(segments: DonutSegment[], radius: number, gap = 0): ComputedStroke[] {
  if (segments.length === 0) return [];
  const sorted = [...segments].sort((a, b) => b.value - a.value);
  const total = sorted.reduce((s, x) => s + x.value, 0);
  const circumference = 2 * Math.PI * radius;
  let offset = 0;
  return sorted.map((seg, i) => {
    const fraction = seg.value / total;
    const length = circumference * fraction;
    const color = seg.color ?? CATEGORY_PALETTE[i % CATEGORY_PALETTE.length];
    const visible = sorted.length > 1 ? Math.max(0.5, length - gap) : length;
    const dasharray = `${visible.toFixed(2)} ${circumference.toFixed(2)}`;
    const stroke: ComputedStroke = { label: seg.label, color, length, offset: -offset, dasharray };
    offset += length;
    return stroke;
  });
}

type DonutChartProps = {
  segments: DonutSegment[];
  centerLabel?: string;
  centerValue?: string;
  centerTrend?: { dir: "up" | "down"; value: string; tone?: "pos" | "neg" };
  size?: number;
  thickness?: number;
  highlightIndex?: number | null;
  onSegmentHover?: (index: number | null) => void;
};

export const DonutChart: Component<DonutChartProps> = (props) => {
  const size = () => props.size ?? 232;
  const thickness = () => props.thickness ?? 20;
  const radius = () => (size() - thickness()) / 2;
  const strokes = () => computeSegmentStrokes(props.segments, radius(), 3);
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
        <circle cx={size() / 2} cy={size() / 2} r={radius()} fill="transparent" stroke="var(--color-sunken)" stroke-width={thickness()} />
        <For each={strokes()}>
          {(stroke, i) => (
            <circle class={cn("segment transition-opacity duration-[160ms] motion-reduce:transition-none")}
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
        {props.centerLabel && <span class="font-mono font-medium text-[11px] text-muted uppercase tracking-[0.1em] mb-2">{props.centerLabel}</span>}
        {props.centerValue && <span class="font-mono tabular text-[28px] tracking-[-0.04em] text-text leading-none">{props.centerValue}</span>}
        {props.centerTrend && (
          <span class={cn("inline-flex items-center gap-1 font-mono tabular text-[12px] mt-2",
            (props.centerTrend.tone ?? (props.centerTrend.dir === "down" ? "pos" : "neg")) === "neg" ? "text-neg" : "text-pos")}>
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
