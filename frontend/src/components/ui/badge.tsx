import { type JSX, splitProps } from "solid-js";
import { cn } from "../../lib/utils";

interface BadgeProps extends JSX.HTMLAttributes<HTMLSpanElement> {
  variant?: "default" | "success" | "destructive" | "warning" | "outline";
}

export function Badge(props: BadgeProps) {
  const [local, others] = splitProps(props, ["variant", "class"]);
  const variants = {
    default: "bg-gray-100 text-gray-700",
    success: "bg-emerald-50 text-emerald-700",
    destructive: "bg-red-50 text-red-700",
    warning: "bg-amber-50 text-amber-700",
    outline: "border border-gray-300 text-gray-700",
  };
  return (
    <span
      class={cn(
        "inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium",
        variants[local.variant ?? "default"],
        local.class
      )}
      {...others}
    />
  );
}
