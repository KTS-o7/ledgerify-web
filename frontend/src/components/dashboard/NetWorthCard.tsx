import { createSignal, Show, type Component } from "solid-js";
import { A } from "@solidjs/router";
import { BentoBlock } from "../ui/bento-block";
import { Eyebrow } from "../ui/eyebrow";
import { SegmentedControl } from "../ui/segmented-control";
import { NumberRoll } from "../ui/number-roll";
import { Money } from "../ui/money";
import { AreaChart } from "../ui/area-chart";
import { sliceRange, sampleLabels, type NetWorthPoint, type Range } from "./data";

type Props = {
  value: number;
  points: NetWorthPoint[];
  /** True when the history is estimated from cash flow (no snapshots yet). */
  estimated: boolean;
};

/** 01 · Net worth: eyebrow, range control, 46px rolling value, delta, 150px area chart. */
export const NetWorthCard: Component<Props> = (props) => {
  const [range, setRange] = createSignal<Range>("1Y");
  const shown = () => sliceRange(props.points, range());
  const delta = () => {
    const p = shown();
    if (p.length < 2) return null;
    const first = p[0]!.value;
    const change = props.value - first;
    const pct = first !== 0 ? (change / Math.abs(first)) * 100 : null;
    return { change, pct };
  };

  return (
    <BentoBlock class="relative overflow-hidden flex flex-col gap-1.5 pt-[22px] px-6 pb-4">
      <div class="flex items-center justify-between gap-3">
        <Eyebrow as="h2">Net worth</Eyebrow>
        <SegmentedControl
          size="sm"
          class="w-[150px]"
          ariaLabel="Net worth range"
          value={range()}
          onChange={setRange}
          options={[{ value: "3M", label: "3M" }, { value: "1Y", label: "1Y" }, { value: "ALL", label: "ALL" }]}
        />
      </div>
      <div class="flex flex-wrap items-baseline gap-x-4 gap-y-1 mt-1">
        <NumberRoll value={props.value} mutedSymbol tone={props.value < 0 ? "neg" : "text"} class="text-[46px] leading-[1.1] font-medium tracking-[-0.04em]" />
        <Show when={delta()}>
          {(d) => (
            <span class={`font-mono tabular text-[13px] font-medium ${d().change < 0 ? "text-neg" : "text-pos"}`}>
              <Money value={d().change} signed tone={d().change < 0 ? "neg" : "pos"} />
              <Show when={d().pct !== null}> · {Math.abs(d().pct!).toFixed(1)}%</Show>
            </span>
          )}
        </Show>
      </div>
      <Show
        when={shown().length > 1}
        fallback={<p class="text-[13px] text-muted py-12 text-center">Not enough history yet. <A href="/networth">Save a snapshot</A> to start the chart.</p>}
      >
        <AreaChart
          class="mt-2"
          height={150}
          values={shown().map((p) => p.value)}
          labels={sampleLabels(shown())}
          ariaLabel={`Net worth over ${range() === "ALL" ? "all time" : range() === "3M" ? "3 months" : "1 year"}`}
        />
      </Show>
      <Show when={props.estimated && shown().length > 1}>
        <p class="text-[11.5px] text-faint mt-1">Estimated from monthly cash flow. <A href="/networth">Snapshots</A> give exact history.</p>
      </Show>
    </BentoBlock>
  );
};
