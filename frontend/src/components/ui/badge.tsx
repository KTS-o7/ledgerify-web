import { type JSX, splitProps } from "solid-js";
import { cn } from "../../lib/utils";

interface BadgeProps extends JSX.HTMLAttributes<HTMLSpanElement> {
  variant?: "default" | "success" | "destructive" | "warning" | "outline";
}

const variants: Record<NonNullable<BadgeProps["variant"]>, string> = {
  default: "bg-surface text-muted",
  success: "bg-primary/10 text-primary",
  destructive: "bg-accent/10 text-accent",
  warning: "bg-accent/10 text-accent",
  outline: "border border-border text-muted",
};

export function Badge(props: BadgeProps) {
  const [local, others] = splitProps(props, ["variant", "class"]);
  return (
    <span class={cn("inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium", variants[local.variant ?? "default"], local.class)} {...others} />
  );
}
