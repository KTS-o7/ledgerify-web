import { createSignal, onCleanup, Show, type JSX } from "solid-js";
import { Copy, Check } from "lucide-solid";
import { cn } from "../../lib/utils";

type CopyButtonProps = {
  value: string;
  label?: string;
  class?: string;
  size?: number;
  variant?: "icon" | "default";
};

async function writeClipboard(value: string) {
  try {
    await navigator.clipboard.writeText(value);
  } catch {
    // Fallback for environments without the clipboard API.
    const ta = document.createElement("textarea");
    ta.value = value;
    ta.style.position = "fixed";
    ta.style.opacity = "0";
    document.body.appendChild(ta);
    ta.focus();
    ta.select();
    try { document.execCommand("copy"); } catch { /* swallow */ }
    document.body.removeChild(ta);
  }
}

/** Copy button: turns into "Copied" with a check on signal-soft for 1.6s. */
export function CopyButton(props: CopyButtonProps): JSX.Element {
  const [copied, setCopied] = createSignal(false);
  const size = () => props.size ?? 14;
  const variant = () => props.variant ?? "icon";
  let timer: ReturnType<typeof setTimeout> | undefined;
  onCleanup(() => clearTimeout(timer));

  async function handleClick(e: MouseEvent) {
    e.stopPropagation();
    e.preventDefault();
    await writeClipboard(props.value);
    setCopied(true);
    clearTimeout(timer);
    timer = setTimeout(() => setCopied(false), 1600);
  }

  if (variant() === "icon") {
    return (
      <button
        type="button"
        onClick={handleClick}
        aria-label={copied() ? "Copied" : props.label ?? "Copy"}
        class={cn("w-8 h-8 flex items-center justify-center rounded-lg text-muted hover:text-text hover:bg-raised transition-colors duration-[160ms] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-signal", copied() && "bg-signal-soft text-signal", props.class)}
      >
        <Show when={copied()} fallback={<Copy size={size()} />}>
          <Check size={size()} />
        </Show>
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      class={cn("h-9 px-3 inline-flex items-center gap-1.5 rounded-[10px] border border-border-strong bg-surface text-[13px] font-semibold text-text hover:bg-raised active:scale-[0.97] transition-[background-color,color,transform] duration-[160ms] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-signal disabled:opacity-50",
        copied() && "bg-signal-soft border-transparent text-signal hover:bg-signal-soft", props.class)}
    >
      <Show when={copied()} fallback={<><Copy size={size()} /><span>{props.label ?? "Copy"}</span></>}>
        <Check size={size()} />
        <span aria-live="polite">Copied</span>
      </Show>
    </button>
  );
}
