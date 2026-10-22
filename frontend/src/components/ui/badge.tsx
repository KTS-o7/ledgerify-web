import { type JSX, splitProps } from "solid-js";
import { cn } from "../../lib/utils";

interface BadgeProps extends JSX.HTMLAttributes<HTMLSpanElement> {
  variant?: "default" | "success" | "destructive" | "warning" | "outline" | "signal";
}

const variants: Record<NonNullable<BadgeProps["variant"]>, string> = {
  default: "bg-raised text-muted",
  success: "bg-pos/12 text-pos",
  destructive: "bg-neg/12 text-neg",
  warning: "bg-warn/12 text-warn",
  outline: "border border-border-strong text-muted",
  signal: "bg-signal-soft text-signal",
};

export function Badge(props: BadgeProps) {
  const [local, others] = splitProps(props, ["variant", "class"]);
  return (
    <span class={cn("inline-flex items-center gap-1 rounded-pill px-2 py-0.5 text-xs font-medium", variants[local.variant ?? "default"], local.class)} {...others} />
  );
}
