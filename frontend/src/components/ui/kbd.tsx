import { type Component, type JSX } from "solid-js";
import { cn } from "../../lib/utils";

/** Keyboard shortcut keycap. Hidden from assistive tech: shortcuts are announced via aria-keyshortcuts. */
export const Kbd: Component<{ class?: string; children: JSX.Element }> = (props) => (
  <kbd
    aria-hidden="true"
    class={cn("inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-[5px] bg-raised text-muted font-mono font-medium text-[11px] leading-none tabular", props.class)}
  >
    {props.children}
  </kbd>
);
