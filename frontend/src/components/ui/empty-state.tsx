import { Show, type Component, type JSX } from "solid-js";
import { Button } from "./button";

type EmptyStateProps = {
  icon?: Component<{ class?: string; size?: number }>;
  title: string;
  body?: string;
  action?: { label: string; onClick: () => void };
  class?: string;
};

export const EmptyState: Component<EmptyStateProps> = (props): JSX.Element => (
  <div
    class={`flex flex-col items-center justify-center text-center px-6 py-12 ${
      props.class ?? ""
    }`}
  >
    <Show when={props.icon}>
      <div class="w-14 h-14 rounded-full bg-surface flex items-center justify-center text-muted mb-4">
        {(() => {
          const Icon = props.icon!;
          return <Icon size={28} />;
        })()}
      </div>
    </Show>
    <h3 class="font-display text-lg font-bold text-text mb-1">{props.title}</h3>
    <Show when={props.body}>
      <p class="text-muted text-sm max-w-sm mb-4">{props.body}</p>
    </Show>
    <Show when={props.action}>
      {(action) => <Button onClick={action().onClick}>{action().label}</Button>}
    </Show>
  </div>
);
