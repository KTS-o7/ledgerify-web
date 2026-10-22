import { For, type JSX } from "solid-js";
import { cn } from "../../lib/utils";

type SegmentedControlProps<T extends string> = {
  options: { value: T; label: string; /** Tailwind text class for the active label, e.g. type colours. */ activeClass?: string }[];
  value: T;
  onChange: (v: T) => void;
  size?: "sm" | "md";
  ariaLabel?: string;
  class?: string;
};

/** Segmented control: sunken track, raised active pill, mono-free sans labels. */
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
      class={cn("flex w-full bg-sunken p-[3px] rounded-[10px]", size() === "sm" ? "h-8" : "h-10", props.class)}
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
                "flex-1 inline-flex items-center justify-center px-2.5 whitespace-nowrap rounded-[8px] font-body font-medium transition-[background-color,color] duration-[160ms] ease-[var(--ease-standard)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-signal",
                size() === "sm" ? "text-[12px]" : "text-[13px]",
                active() ? cn("bg-raised", opt.activeClass ?? "text-text") : "text-muted hover:text-text"
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
