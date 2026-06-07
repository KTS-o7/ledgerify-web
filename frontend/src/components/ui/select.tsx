import { type JSX, splitProps } from "solid-js";
import { cn } from "../../lib/utils";

export function Select(props: JSX.SelectHTMLAttributes<HTMLSelectElement>) {
  const [local, others] = splitProps(props, ["class"]);
  return (
    <select
      class={cn(
        "flex h-12 w-full rounded-input border border-border bg-surface px-4 py-1 text-base text-text focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary disabled:cursor-not-allowed disabled:opacity-50",
        local.class
      )}
      {...others}
    />
  );
}
