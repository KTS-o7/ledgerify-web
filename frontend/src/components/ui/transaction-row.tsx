import { type Component, type JSX, Show } from "solid-js";
import { formatCurrency, formatDate } from "../../lib/format";
import { cn } from "../../lib/utils";
import { Pencil, Trash2 } from "lucide-solid";

type TransactionRowProps = {
  icon: Component<{ class?: string; size?: number }>;
  merchant: string;
  category: string;
  amount: number;
  type: "income" | "expense" | "transfer";
  date: string;
  onClick?: () => void;
  onEdit?: () => void;
  onDelete?: () => void;
};

const typePrefix = { income: "+", expense: "-", transfer: "" } as const;
const typeTone = { income: "text-primary", expense: "text-text", transfer: "text-muted" } as const;

export const TransactionRow: Component<TransactionRowProps> = (props) => {
  const content = (): JSX.Element => (
    <div class="group flex items-center gap-4 h-[72px]">
      <div class="w-10 h-10 rounded-lg bg-bg flex items-center justify-center text-muted">
        {(() => { const Icon = props.icon; return <Icon size={20} />; })()}
      </div>
      <div class="flex-1 min-w-0">
        <div class="font-body text-base text-text truncate">{props.merchant}</div>
        <div class="font-body text-[13px] font-medium text-muted mt-0.5">{props.category} · {formatDate(props.date)}</div>
      </div>
      <div class={cn("font-display font-semibold text-lg", typeTone[props.type])}
        aria-label={`${typePrefix[props.type]}${formatCurrency(Math.abs(props.amount))} ${props.type}`}>
        {typePrefix[props.type]}{formatCurrency(Math.abs(props.amount))}
      </div>
      <Show when={props.onEdit || props.onDelete}>
        <div class="flex items-center gap-1 ml-2 opacity-0 group-hover:opacity-100 transition-opacity md:opacity-100">
          <Show when={props.onEdit}>
            <button type="button" onClick={(e) => { e.stopPropagation(); props.onEdit!(); }}
              aria-label="Edit transaction"
              class="w-8 h-8 flex items-center justify-center rounded-lg text-muted hover:text-text hover:bg-surface-hover transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-bg">
              <Pencil size={14} />
            </button>
          </Show>
          <Show when={props.onDelete}>
            <button type="button" onClick={(e) => { e.stopPropagation(); props.onDelete!(); }}
              aria-label="Delete transaction"
              class="w-8 h-8 flex items-center justify-center rounded-lg text-muted hover:text-accent hover:bg-accent/10 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-bg">
              <Trash2 size={14} />
            </button>
          </Show>
        </div>
      </Show>
    </div>
  );
  if (props.onClick) {
    return (
      <button type="button" onClick={props.onClick} class="w-full text-left active:bg-surface-hover transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-bg"
        aria-label={`${props.merchant}, ${props.category}, ${props.type}, ${typePrefix[props.type]}${formatCurrency(Math.abs(props.amount))}, ${formatDate(props.date)}`}>
        {content()}
      </button>
    );
  }
  return content() as JSX.Element;
};
