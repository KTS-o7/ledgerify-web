import { type JSX, splitProps } from "solid-js";
import { cn } from "../../lib/utils";

export function Select(props: JSX.SelectHTMLAttributes<HTMLSelectElement>) {
  const [local, others] = splitProps(props, ["class"]);
  return (
    <select
      class={cn(
        "flex h-9 w-full rounded-lg border border-gray-300 bg-white px-3 py-1 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-[#c25a3e] focus:border-[#c25a3e] disabled:cursor-not-allowed disabled:opacity-50",
        local.class
      )}
      {...others}
    />
  );
}
