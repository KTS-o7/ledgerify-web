import { type JSX, splitProps } from "solid-js";
import { cn } from "../../lib/utils";

export function Input(props: JSX.InputHTMLAttributes<HTMLInputElement>) {
  const [local, others] = splitProps(props, ["class"]);
  return (
    <input
      class={cn(
        "flex h-12 w-full rounded-input border border-border bg-surface px-4 py-1 text-base text-text placeholder:text-muted transition-colors focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary disabled:cursor-not-allowed disabled:opacity-50",
        local.class
      )}
      {...others}
    />
  );
}
