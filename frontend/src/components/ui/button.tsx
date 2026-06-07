import { type VariantProps, cva } from "class-variance-authority";
import { type JSX, splitProps } from "solid-js";
import { cn } from "../../lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 rounded-button text-[15px] font-display font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-bg disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      variant: {
        default: "bg-primary text-bg hover:bg-primary-press",
        destructive: "bg-accent text-bg hover:bg-accent/90",
        outline: "border border-border bg-transparent text-text hover:bg-surface-hover",
        ghost: "bg-transparent text-muted hover:text-text hover:bg-surface-hover",
        link: "text-primary underline-offset-4 hover:underline",
      },
      size: {
        default: "h-11 px-5",
        sm: "h-9 rounded-md px-3 text-sm",
        lg: "h-12 px-6 text-base",
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
