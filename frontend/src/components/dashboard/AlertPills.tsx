import { For, Show, type Component } from "solid-js";
import { cn } from "../../lib/utils";

export interface AlertItem {
  key: string;
  text: string;
  meta?: string;
  /** warn for budgets at 90% or more, signal for everything else. */
  level: "warn" | "signal";
  href?: string;
}

/** 01 · Alert pills: 30px pills with a coloured dot. */
export const AlertPills: Component<{ alerts: AlertItem[] }> = (props) => (
  <Show when={props.alerts.length > 0}>
    <ul class="flex gap-2 overflow-x-auto scrollbar-none -mx-5 px-5 md:mx-0 md:px-0 md:flex-wrap" aria-label="Alerts">
      <For each={props.alerts}>
        {(a) => (
          <li class="shrink-0 flex items-center gap-2 h-[30px] px-3 rounded-pill bg-surface border border-border text-[12.5px] font-medium text-text whitespace-nowrap">
            <span class={cn("w-1.5 h-1.5 rounded-full", a.level === "warn" ? "bg-warn" : "bg-signal")} aria-hidden="true" />
            <span>{a.text}</span>
            <Show when={a.meta}><span class="text-muted">{a.meta}</span></Show>
          </li>
        )}
      </For>
    </ul>
  </Show>
);
