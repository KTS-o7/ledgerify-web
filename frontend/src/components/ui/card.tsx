import { type JSX, splitProps } from "solid-js";
import { cn } from "../../lib/utils";

export function Card(props: JSX.HTMLAttributes<HTMLDivElement>) {
  const [local, others] = splitProps(props, ["class"]);
  return (
    <div class={cn("rounded-xl border border-gray-200 bg-white shadow-sm", local.class)} {...others} />
  );
}

export function CardHeader(props: JSX.HTMLAttributes<HTMLDivElement>) {
  const [local, others] = splitProps(props, ["class"]);
  return <div class={cn("flex flex-col gap-1 p-5", local.class)} {...others} />;
}

export function CardTitle(props: JSX.HTMLAttributes<HTMLHeadingElement>) {
  const [local, others] = splitProps(props, ["class"]);
  return <h3 class={cn("text-sm font-semibold text-gray-900", local.class)} {...others} />;
}

export function CardContent(props: JSX.HTMLAttributes<HTMLDivElement>) {
  const [local, others] = splitProps(props, ["class"]);
  return <div class={cn("p-5 pt-0", local.class)} {...others} />;
}
