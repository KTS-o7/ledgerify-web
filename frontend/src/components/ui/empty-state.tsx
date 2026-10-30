import { Show, type Component, type JSX } from "solid-js";
import { Button } from "./button";

type EmptyStateProps = {
  icon?: Component<{ class?: string; size?: number }>;
  title: string;
  body?: string;
  action?: { label: string; onClick: () => void };
  class?: string;
};

/** Empty or done state: serif headline at 34px, muted body, one action. */
export const EmptyState: Component<EmptyStateProps> = (props): JSX.Element => (
  <div class={`flex flex-col items-center justify-center text-center px-6 py-12 ${props.class ?? ""}`}>
    <Show when={props.icon}>
      <div class="w-12 h-12 rounded-[14px] bg-raised flex items-center justify-center text-muted mb-5">
        {(() => {
          const Icon = props.icon!;
          return <Icon size={22} />;
        })()}
      </div>
    </Show>
    <h3 class="font-display font-normal text-[34px] leading-[1.05] text-text mb-2 text-balance">{props.title}</h3>
    <Show when={props.body}>
      <p class="text-muted text-[14px] max-w-sm mb-5 text-pretty">{props.body}</p>
    </Show>
    <Show when={props.action}>
      {(action) => <Button onClick={action().onClick}>{action().label}</Button>}
    </Show>
  </div>
);
