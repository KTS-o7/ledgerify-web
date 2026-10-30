import { type JSX, splitProps } from "solid-js";
import { cn } from "../../lib/utils";

export function Input(props: JSX.InputHTMLAttributes<HTMLInputElement>) {
  const [local, others] = splitProps(props, ["class"]);
  return (
    <input
      class={cn(
        "flex h-11 w-full rounded-input border border-border-strong bg-surface px-3.5 py-1 text-[15px] text-text placeholder:text-faint transition-colors duration-[160ms] focus:outline-none focus:border-signal disabled:cursor-not-allowed disabled:opacity-50",
        local.class
      )}
      {...others}
    />
  );
}
