import { type Component } from "solid-js";
import { cn } from "../../lib/utils";

type CategoryBarProps = { value: number; color?: string; trackColor?: string; class?: string };

export const CategoryBar: Component<CategoryBarProps> = (props) => {
  const pct = () => {
    const v = props.value;
    if (v <= 1) return Math.max(0, Math.min(1, v)) * 100;
    return Math.max(0, Math.min(100, v));
  };
  return (
    <div
      class={cn(
        "h-1 w-full rounded-full overflow-hidden",
        props.trackColor ?? "bg-surface-hover",
        props.class
      )}
    >
      <div
        class="h-full rounded-full transition-all duration-200 motion-reduce:transition-none"
        style={{
          width: `${pct()}%`,
          "background-color": props.color ?? "var(--color-text)",
        }}
      />
    </div>
  );
};
