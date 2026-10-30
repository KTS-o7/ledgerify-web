import { Show, type Component, type JSX } from "solid-js";
import { Plus, Pencil, Trash2, ChevronDown } from "lucide-solid";
import { cn } from "../../lib/utils";

/** Header primary action, e.g. "Add holding". Icon-only below md. */
export const AddButton: Component<{ label: string; onClick: () => void }> = (props) => (
  <button
    type="button"
    onClick={props.onClick}
    aria-label={props.label}
    class="inline-flex items-center justify-center gap-1.5 h-9 w-9 md:w-auto md:px-3 rounded-[10px] bg-btn text-btn-text text-[13.5px] font-semibold hover:opacity-90 active:scale-[0.97] transition-[opacity,transform] duration-[90ms] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-signal focus-visible:ring-offset-2 focus-visible:ring-offset-bg motion-reduce:active:scale-100"
  >
    <Plus size={16} />
    <span class="hidden md:inline">{props.label}</span>
  </button>
);

const iconBtn = "w-8 h-8 flex items-center justify-center rounded-[8px] text-muted hover:bg-raised transition-colors duration-[160ms] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-signal";

/** Edit / delete pair; always visible on touch, on hover or focus on desktop. */
export const RowActions: Component<{ name: string; onEdit: () => void; onDelete: () => void; class?: string }> = (props) => (
  <div class={cn("flex gap-0.5 opacity-100 md:opacity-0 md:group-hover:opacity-100 md:group-focus-within:opacity-100 transition-opacity duration-[160ms]", props.class)}>
    <button type="button" onClick={(e) => { e.stopPropagation(); props.onEdit(); }} aria-label={`Edit ${props.name}`} class={cn(iconBtn, "hover:text-text")}>
      <Pencil size={14} />
    </button>
    <button type="button" onClick={(e) => { e.stopPropagation(); props.onDelete(); }} aria-label={`Delete ${props.name}`} class={cn(iconBtn, "hover:text-neg")}>
      <Trash2 size={14} />
    </button>
  </div>
);

/** Text toggle that reveals a detail panel (payments, transactions, schedule). */
export const DisclosureButton: Component<{ open: boolean; onClick: () => void; children: JSX.Element; controls?: string }> = (props) => (
  <button
    type="button"
    onClick={props.onClick}
    aria-expanded={props.open}
    aria-controls={props.controls}
    class="inline-flex items-center gap-1 h-7 px-2 -ml-2 rounded-[8px] text-[12.5px] font-medium text-muted hover:text-text hover:bg-raised transition-colors duration-[160ms] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-signal"
  >
    <ChevronDown size={13} class={cn("transition-transform duration-[160ms]", props.open && "rotate-180")} />
    {props.children}
  </button>
);

/** Small label + mono value pair used inside wealth cards. */
export const Figure: Component<{ label: string; children: JSX.Element; sub?: JSX.Element; class?: string }> = (props) => (
  <div class={cn("min-w-0", props.class)}>
    <div class="font-mono font-medium text-[10.5px] uppercase tracking-[0.1em] text-muted">{props.label}</div>
    <div class="font-mono tabular text-[15px] text-text mt-1 truncate">{props.children}</div>
    <Show when={props.sub}><div class="font-mono tabular text-[11px] text-faint mt-0.5">{props.sub}</div></Show>
  </div>
);

/** Compact inline input/select class for nested forms (payments, investment transactions). */
export const inlineField =
  "h-9 rounded-[10px] border border-border-strong bg-surface px-2.5 text-[13.5px] text-text placeholder:text-faint focus:outline-none focus:border-signal transition-colors duration-[160ms]";

/** Status tone for payment rows. */
export function paymentTone(status: string): string {
  if (status === "paid") return "text-pos";
  if (status === "missed") return "text-neg";
  if (status === "due" || status === "partial" || status === "scheduled") return "text-warn";
  return "text-muted";
}

/** "12 Mar 2026" from YYYY-MM-DD; falls back to the input. */
export function shortDate(iso: string): string {
  if (!iso) return "";
  const d = new Date(iso.length === 10 ? iso + "T00:00:00" : iso);
  if (isNaN(d.getTime())) return iso;
  return new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", year: "numeric" }).format(d);
}

/** Signed percentage with a real minus sign. */
export function pct(n: number, digits = 1): string {
  const s = Math.abs(n).toFixed(digits);
  return `${n > 0 ? "+" : n < 0 ? "−" : ""}${s}%`;
}
