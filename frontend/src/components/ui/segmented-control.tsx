import { For, type JSX } from "solid-js";
import { cn } from "../../lib/utils";

type SegmentedControlProps<T extends string> = {
  options: { value: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
  size?: "sm" | "md";
  ariaLabel?: string;
};

export function SegmentedControl<T extends string>(props: SegmentedControlProps<T>): JSX.Element {
  const size = () => props.size ?? "md";
  const onKey = (e: KeyboardEvent, i: number) => {
    if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
    e.preventDefault();
    const dir = e.key === "ArrowRight" ? 1 : -1;
    const next = (i + dir + props.options.length) % props.options.length;
    props.onChange(props.options[next]!.value);
    const el = (e.currentTarget as HTMLElement).parentElement?.querySelectorAll<HTMLButtonElement>(
      "[role='tab']"
    )[next];
    el?.focus();
  };
  return (
    <div
      class={cn("flex w-full bg-surface p-1 rounded-pill", size() === "sm" ? "h-9" : "h-11")}
      role="tablist"
      aria-label={props.ariaLabel}
    >
      <For each={props.options}>
        {(opt, i) => {
          const active = () => opt.value === props.value;
          return (
            <button
              type="button"
              role="tab"
              aria-selected={active()}
              tabindex={active() ? 0 : -1}
              onClick={() => props.onChange(opt.value)}
              onKeyDown={(e) => onKey(e, i())}
              class={cn(
                "flex-1 inline-flex items-center justify-center rounded-pill text-sm font-display font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-bg",
                active() ? "bg-text text-bg" : "text-muted hover:text-text"
              )}
            >
              {opt.label}
            </button>
          );
        }}
      </For>
    </div>
  );
}
