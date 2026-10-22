import { type JSX, splitProps } from "solid-js";
import { cn } from "../../lib/utils";

export function Select(props: JSX.SelectHTMLAttributes<HTMLSelectElement>) {
  const [local, others] = splitProps(props, ["class"]);
  return (
    <select
      class={cn(
        "flex h-11 w-full rounded-input border border-border-strong bg-surface px-3.5 py-1 text-[15px] text-text transition-colors duration-[160ms] focus:outline-none focus:border-signal disabled:cursor-not-allowed disabled:opacity-50",
        local.class
      )}
      {...others}
    />
  );
}
