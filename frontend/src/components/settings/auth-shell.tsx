import { Show, type JSX, type Component } from "solid-js";
import { Wordmark } from "../ui/nav";
import { cn } from "../../lib/utils";

/** Full-screen aurora shell for Sign in and Register (screen 02). */
export const AuthShell: Component<{ children: JSX.Element; error?: string }> = (props) => (
  <div class="relative min-h-screen overflow-hidden bg-bg text-text aurora flex items-center justify-center px-5 py-12 pt-[calc(48px+env(safe-area-inset-top))]">
    <div class="relative z-10 w-full max-w-[380px] flex flex-col">
      <div class="flex flex-col items-center text-center mb-10">
        <Wordmark size="lg" />
        <p class="mt-4 text-[15px] text-muted text-pretty max-w-[300px]">Every account, currency and goal in one quiet ledger.</p>
      </div>
      <Show when={props.error}>
        <div role="alert" class="mb-4 rounded-[14px] border border-neg/40 bg-neg/10 px-4 py-3 text-[13.5px] text-neg">{props.error}</div>
      </Show>
      {props.children}
    </div>
  </div>
);

/** 52px field, radius 14, signal border on focus, with a visible label. */
export const AuthField: Component<{
  id: string;
  label: string;
  type: string;
  value: string;
  onInput: (v: string) => void;
  autocomplete: string;
  minLength?: number;
}> = (props) => (
  <div class="flex flex-col gap-1.5">
    <label for={props.id} class="text-[12.5px] font-medium text-muted">{props.label}</label>
    <input
      id={props.id}
      type={props.type}
      value={props.value}
      onInput={(e) => props.onInput(e.currentTarget.value)}
      required
      minLength={props.minLength}
      autocomplete={props.autocomplete}
      class={cn(
        "h-[52px] w-full rounded-[14px] border border-border-strong bg-surface px-4 text-[16px] text-text placeholder:text-faint",
        "transition-colors duration-[160ms] focus:outline-none focus:border-signal"
      )}
    />
  </div>
);
