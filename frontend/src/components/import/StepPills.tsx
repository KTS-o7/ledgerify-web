import { For, type Component } from "solid-js";
import { Check } from "lucide-solid";
import { cn } from "../../lib/utils";

export type Step = 1 | 2 | 3 | 4;
const LABELS = ["Upload", "Map columns", "Review", "Done"] as const;

type StepPillsProps = {
  step: Step;
  /** Highest step the user may jump back to. */
  reachable: Step;
  onSelect: (s: Step) => void;
  class?: string;
};

/** Upload · Map columns · Review · Done. Earlier steps stay clickable until the import runs. */
export const StepPills: Component<StepPillsProps> = (props) => (
  <ol class={cn("flex items-center gap-1.5", props.class)} aria-label="Import steps">
    <For each={LABELS}>
      {(label, i) => {
        const n = (i() + 1) as Step;
        const current = () => props.step === n;
        const done = () => n < props.step;
        const enabled = () => n <= props.reachable && !current();
        return (
          <li>
            <button
              type="button"
              disabled={!enabled()}
              onClick={() => props.onSelect(n)}
              aria-current={current() ? "step" : undefined}
              class={cn(
                "flex items-center gap-2 h-8 pl-1.5 pr-3 rounded-pill text-[13px] font-medium transition-colors duration-[160ms] ease-[var(--ease-standard)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-signal",
                current() ? "bg-raised text-text" : "text-muted",
                enabled() && "hover:bg-raised hover:text-text cursor-pointer",
                !enabled() && !current() && "cursor-default",
              )}
            >
              <span
                class={cn(
                  "w-5 h-5 rounded-full flex items-center justify-center font-mono font-semibold text-[11px] tabular",
                  current() ? "bg-btn text-btn-text" : done() ? "bg-signal-soft text-signal" : "bg-sunken text-muted",
                )}
                aria-hidden="true"
              >
                {done() ? <Check size={11} stroke-width={3} /> : n}
              </span>
              <span class={cn(!current() && "hidden lg:inline")}>{label}</span>
              <span class="sr-only">{done() ? " (done)" : ""}</span>
            </button>
          </li>
        );
      }}
    </For>
  </ol>
);
