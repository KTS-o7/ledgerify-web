import { createUniqueId, For, Show, type Component } from "solid-js";
import { cn } from "../../lib/utils";

/** Smooth path through points using a monotone cubic (no overshoot below 0). */
export function smoothPath(pts: Array<[number, number]>): string {
  if (pts.length === 0) return "";
  if (pts.length === 1) return `M ${pts[0][0]} ${pts[0][1]}`;
  const n = pts.length;
  const dx: number[] = [], m: number[] = [], t: number[] = [];
  for (let i = 0; i < n - 1; i++) {
    dx[i] = pts[i + 1][0] - pts[i][0];
    m[i] = (pts[i + 1][1] - pts[i][1]) / (dx[i] || 1);
  }
  t[0] = m[0]; t[n - 1] = m[n - 2];
  for (let i = 1; i < n - 1; i++) t[i] = m[i - 1] * m[i] <= 0 ? 0 : (m[i - 1] + m[i]) / 2;
  let d = `M ${pts[0][0].toFixed(2)} ${pts[0][1].toFixed(2)}`;
  for (let i = 0; i < n - 1; i++) {
    const [x0, y0] = pts[i], [x1, y1] = pts[i + 1];
    const h = dx[i] / 3;
    d += ` C ${(x0 + h).toFixed(2)} ${(y0 + t[i] * h).toFixed(2)}, ${(x1 - h).toFixed(2)} ${(y1 - t[i + 1] * h).toFixed(2)}, ${x1.toFixed(2)} ${y1.toFixed(2)}`;
  }
  return d;
}

type AreaChartProps = {
  values: number[];
  labels?: string[];
  height?: number;
  /** Draw a dot on the last point. */
  endDot?: boolean;
  /** CSS colour for stroke + fill; defaults to the signal token. */
  color?: string;
  class?: string;
  ariaLabel?: string;
};

const W = 600; // internal viewBox width; the SVG stretches to its container

/** Area chart: 1.6px stroke, gradient fill 22% → 0, optional month labels. */
export const AreaChart: Component<AreaChartProps> = (props) => {
  const id = createUniqueId();
  const h = () => props.height ?? 150;
  const color = () => props.color ?? "var(--color-signal)";
  const points = (): Array<[number, number]> => {
    const v = props.values;
    if (v.length === 0) return [];
    const min = Math.min(...v), max = Math.max(...v);
    const range = max - min || 1;
    const pad = 8;
    const step = v.length > 1 ? W / (v.length - 1) : 0;
    return v.map((y, i) => [i * step, pad + (1 - (y - min) / range) * (h() - pad * 2)]);
  };
  const line = () => smoothPath(points());
  const area = () => {
    const p = points();
    if (p.length < 2) return "";
    return `${line()} L ${W} ${h()} L 0 ${h()} Z`;
  };
  const last = () => points()[points().length - 1];

  return (
    <div class={cn("relative w-full", props.class)}>
      <div class="relative w-full" style={{ height: `${h()}px` }}>
        <svg class="absolute inset-0 w-full h-full overflow-visible" viewBox={`0 0 ${W} ${h()}`} preserveAspectRatio="none" role="img" aria-label={props.ariaLabel ?? "Trend chart"}>
          <defs>
            <linearGradient id={`g-${id}`} x1="0" x2="0" y1="0" y2="1">
              <stop offset="0%" stop-color={color()} stop-opacity="0.22" />
              <stop offset="100%" stop-color={color()} stop-opacity="0" />
            </linearGradient>
          </defs>
          <path d={area()} fill={`url(#g-${id})`} />
          <path d={line()} fill="none" stroke={color()} stroke-width="1.6" vector-effect="non-scaling-stroke" stroke-linecap="round" stroke-linejoin="round" />
        </svg>
        <Show when={props.endDot && last()}>
          {(p) => (
            <span
              aria-hidden="true"
              class="absolute w-2 h-2 -ml-1 -mt-1 rounded-full ring-4 ring-signal-soft"
              style={{ left: `${(p()[0] / W) * 100}%`, top: `${p()[1]}px`, background: color() }}
            />
          )}
        </Show>
      </div>
      <Show when={props.labels && props.labels.length > 0}>
        <div class="flex justify-between mt-2 font-mono text-[10.5px] text-faint tabular" aria-hidden="true">
          <For each={props.labels}>{(l) => <span>{l}</span>}</For>
        </div>
      </Show>
    </div>
  );
};
