import { type Component, type JSX } from "solid-js";
import { cn } from "../../lib/utils";

type SkeletonBlockProps = { class?: string };
type SkeletonRowProps = { class?: string };

export const SkeletonBlock: Component<SkeletonBlockProps> = (props): JSX.Element => (
  <div
    class={cn(
      "h-40 w-full rounded-bento bg-surface-hover animate-pulse motion-reduce:animate-none",
      props.class
    )}
  />
);

export const SkeletonRow: Component<SkeletonRowProps> = (props): JSX.Element => (
  <div
    class={cn(
      "h-[72px] w-full rounded-input bg-surface-hover animate-pulse motion-reduce:animate-none",
      props.class
    )}
  />
);
