import { type Component, type JSX } from "solid-js";
import { cn } from "../../lib/utils";

/** Section label: Geist Mono 500, 11px, uppercase, 0.1em tracking, muted. */
export const Eyebrow: Component<{ class?: string; children: JSX.Element; as?: "span" | "h2" | "h3" }> = (props) => {
  const cls = () => cn("font-mono font-medium text-[11px] leading-none uppercase tracking-[0.1em] text-muted", props.class);
  if (props.as === "h2") return <h2 class={cls()}>{props.children}</h2>;
  if (props.as === "h3") return <h3 class={cls()}>{props.children}</h3>;
  return <span class={cls()}>{props.children}</span>;
};
