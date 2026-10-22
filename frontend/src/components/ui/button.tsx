import { type VariantProps, cva } from "class-variance-authority";
import { type JSX, splitProps } from "solid-js";
import { cn } from "../../lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 rounded-button text-[13.5px] font-body font-semibold transition-[background-color,color,border-color,transform] duration-[160ms] ease-[var(--ease-standard)] active:scale-[0.97] active:duration-[90ms] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-signal focus-visible:ring-offset-2 focus-visible:ring-offset-bg disabled:pointer-events-none disabled:opacity-50 motion-reduce:active:scale-100",
  {
    variants: {
      variant: {
        default: "bg-btn text-btn-text hover:opacity-90",
        destructive: "bg-neg text-bg hover:opacity-90",
        outline: "border border-border-strong bg-transparent text-text hover:bg-raised",
        ghost: "bg-transparent text-muted hover:text-text hover:bg-raised",
        link: "text-signal underline-offset-4 hover:underline",
      },
      size: {
        default: "h-10 px-4",
        sm: "h-8 rounded-[10px] px-3 text-[13px]",
        lg: "h-[52px] px-6 text-[15px] rounded-[14px]",
        icon: "h-10 w-10",
      },
    },
    defaultVariants: { variant: "default", size: "default" },
  }
);

interface ButtonProps extends JSX.ButtonHTMLAttributes<HTMLButtonElement>, VariantProps<typeof buttonVariants> {}

export function Button(props: ButtonProps) {
  const [local, others] = splitProps(props, ["variant", "size", "class"]);
  return <button class={cn(buttonVariants({ variant: local.variant, size: local.size }), local.class)} {...others} />;
}
