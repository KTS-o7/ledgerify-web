import { type Component, type JSX, Show } from "solid-js";
import { formatCurrency, formatDate } from "../../lib/format";
import { cn } from "../../lib/utils";
import { Pencil, Repeat, Trash2 } from "lucide-solid";
import { Money } from "./money";

type TransactionRowProps = {
  icon: Component<{ class?: string; size?: number }>;
  merchant: string;
  category: string;
  amount: number;
  type: "income" | "expense" | "transfer";
  date: string;
  currency?: string;
  /** CSS colour for the icon tile, usually the category colour. */
  color?: string;
  recurring?: boolean;
  /** Queued offline, waiting for the service worker to sync it. */
  pending?: boolean;
  selected?: boolean;
  onClick?: () => void;
  onEdit?: () => void;
  onDelete?: () => void;
};

const typePrefix = { income: "+", expense: "−", transfer: "" } as const;
// Expenses stay in text; only money in gets a hue.
const typeTone = { income: "pos", expense: "text", transfer: "muted" } as const;

/** 60px mobile-first row: 38px category tile, merchant, category · date, mono amount. */
export const TransactionRow: Component<TransactionRowProps> = (props) => {
  const label = () => `${props.merchant}, ${props.category}, ${props.type}, ${typePrefix[props.type]}${formatCurrency(Math.abs(props.amount), props.currency)}, ${formatDate(props.date)}${props.pending ? ", waiting to sync" : ""}`;
  const content = (): JSX.Element => (
    <div class="group flex items-center gap-3 h-[60px]">
      <div
        class={cn("w-[38px] h-[38px] shrink-0 rounded-[10px] flex items-center justify-center",
          props.pending ? "border border-dashed border-border-strong text-muted" : "bg-raised")}
        style={!props.pending && props.color ? { color: props.color } : undefined}
      >
        {(() => { const Icon = props.icon; return <Icon size={18} />; })()}
      </div>
      <div class="flex-1 min-w-0">
        <div class="text-[14.5px] font-medium text-text truncate flex items-center gap-1.5">
          <span class="truncate">{props.merchant}</span>
          <Show when={props.recurring}>
            <span title="Part of a recurring rule" class="shrink-0 inline-flex text-muted">
              <Repeat size={12} />
            </span>
          </Show>
        </div>
        <div class="text-[12.5px] text-muted mt-0.5 truncate">
          <Show when={props.pending} fallback={<>{props.category} · <span class="font-mono tabular">{formatDate(props.date)}</span></>}>
            <span class="text-warn">Waiting to sync</span>
          </Show>
        </div>
      </div>
      <span aria-hidden="true" class={cn("font-mono tabular text-[14.5px] shrink-0", props.type === "income" ? "text-pos" : props.type === "transfer" ? "text-muted" : "text-text")}>
        {typePrefix[props.type]}<Money value={Math.abs(props.amount)} currency={props.currency} tone={typeTone[props.type]} />
      </span>
      <Show when={props.onEdit || props.onDelete}>
        <div class="flex items-center gap-0.5 ml-1 opacity-100 md:opacity-0 md:group-hover:opacity-100 md:group-focus-within:opacity-100 transition-opacity duration-[160ms]">
          <Show when={props.onEdit}>
            <button type="button" onClick={(e) => { e.stopPropagation(); props.onEdit!(); }}
              aria-label="Edit transaction"
              class="w-8 h-8 flex items-center justify-center rounded-lg text-muted hover:text-text hover:bg-raised transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-signal">
              <Pencil size={14} />
            </button>
          </Show>
          <Show when={props.onDelete}>
            <button type="button" onClick={(e) => { e.stopPropagation(); props.onDelete!(); }}
              aria-label="Delete transaction"
              class="w-8 h-8 flex items-center justify-center rounded-lg text-muted hover:text-neg hover:bg-raised transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-signal">
              <Trash2 size={14} />
            </button>
          </Show>
        </div>
      </Show>
    </div>
  );
  const sign = () => typePrefix[props.type];
  if (props.onClick) {
    return (
      <div
        role="button"
        tabindex="0"
        onClick={props.onClick}
        onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); props.onClick!(); } }}
        aria-label={label()}
        data-sign={sign()}
        class={cn("w-full text-left rounded-[10px] px-2 -mx-2 hover:bg-raised active:bg-raised transition-colors duration-[160ms] cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-signal",
          props.selected && "bg-signal-soft hover:bg-signal-soft")}
      >
        {content()}
      </div>
    );
  }
  return <div aria-label={label()} data-sign={sign()}>{content()}</div>;
};
