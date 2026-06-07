import { type JSX, splitProps, type Component } from "solid-js";
import { cn } from "../../lib/utils";

type BentoBlockProps = JSX.HTMLAttributes<HTMLDivElement> & {
  variant?: "default" | "pressable" | "dashed";
  size?: "sm" | "md" | "lg";
  span?: 1 | 2 | 3;
  as?: "div" | "button" | "a";
  onClick?: JSX.EventHandlerUnion<HTMLDivElement, MouseEvent>;
};

const sizeMap = { sm: "", md: "", lg: "" };
const spanMap = { 1: "col-span-1", 2: "col-span-2", 3: "col-span-3" };

export const BentoBlock: Component<BentoBlockProps> = (props) => {
  const [local, others] = splitProps(props, ["variant", "size", "span", "class", "children", "as"]);
  const variant = () => local.variant ?? "default";
  const size = () => local.size ?? "md";
  const span = () => local.span ?? 1;
  const base = "rounded-[24px] p-[20px] border transition-all duration-150 motion-reduce:transition-none";
  const variantClass = () => {
    const v = variant();
    if (v === "pressable") return "bg-surface border-border active:scale-[0.96] active:bg-surface-hover cursor-pointer lg:hover:border-border-strong lg:hover:bg-surface-hover";
    if (v === "dashed") return "bg-transparent border-border border-dashed";
    return "bg-surface border-border";
  };
  return <div class={cn(base, sizeMap[size()], spanMap[span()], variantClass(), local.class)} {...others}>{local.children}</div>;
};
