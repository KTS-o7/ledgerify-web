import { createSignal, Show, type JSX } from "solid-js";
import { Copy, Check } from "lucide-solid";

type CopyButtonProps = {
  value: string;
  label?: string;
  class?: string;
  size?: number;
  variant?: "icon" | "default";
};

export function CopyButton(props: CopyButtonProps): JSX.Element {
  const [copied, setCopied] = createSignal(false);
  const size = () => props.size ?? 14;
  const variant = () => props.variant ?? "icon";

  async function handleClick(e: MouseEvent) {
    e.stopPropagation();
    e.preventDefault();
    try {
      await navigator.clipboard.writeText(props.value);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // Fallback for environments without clipboard API: select a hidden textarea
      const ta = document.createElement("textarea");
      ta.value = props.value;
      ta.style.position = "fixed";
      ta.style.opacity = "0";
      document.body.appendChild(ta);
      ta.focus();
      ta.select();
      try { document.execCommand("copy"); } catch { /* swallow */ }
      document.body.removeChild(ta);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    }
  }

  if (variant() === "icon") {
    return (
      <button
        type="button"
        onClick={handleClick}
        aria-label={props.label ?? "Copy"}
        class={`w-8 h-8 flex items-center justify-center rounded-lg text-muted hover:text-text transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-bg ${props.class ?? ""}`}
      >
        <Show when={copied()} fallback={<Copy size={size()} />}>
          <Check size={size()} class="text-primary" />
        </Show>
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      class={`h-9 px-3 inline-flex items-center gap-1.5 rounded-lg border border-border bg-surface text-sm font-medium text-text hover:bg-surface-hover active:scale-95 transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-bg disabled:opacity-50 ${props.class ?? ""}`}
    >
      <Show when={copied()} fallback={
        <>
          <Copy size={size()} />
          <span>{props.label ?? "Copy"}</span>
        </>
      }>
        <Check size={size()} class="text-primary" />
        <span>Copied</span>
      </Show>
    </button>
  );
}
