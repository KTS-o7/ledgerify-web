import { type VariantProps, cva } from "class-variance-authority";
import { type JSX, splitProps } from "solid-js";
import { cn } from "../../lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 rounded-lg text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      variant: {
        default: "bg-[#c25a3e] text-white hover:bg-[#a34730]",
        destructive: "bg-red-600 text-white hover:bg-red-700",
        outline: "border border-gray-300 bg-white hover:bg-gray-50 text-gray-900",
        ghost: "hover:bg-gray-100 text-gray-700",
        link: "text-[#c25a3e] underline-offset-4 hover:underline",
      },
      size: {
        default: "h-9 px-4 py-2",
        sm: "h-7 rounded-md px-3 text-xs",
        lg: "h-11 rounded-lg px-8",
        icon: "h-9 w-9",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
);

interface ButtonProps
  extends JSX.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {}

export function Button(props: ButtonProps) {
  const [local, others] = splitProps(props, ["variant", "size", "class"]);
  return (
    <button
      class={cn(buttonVariants({ variant: local.variant, size: local.size }), local.class)}
      {...others}
    />
  );
}
