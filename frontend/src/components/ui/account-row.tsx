import { Show, type Component, type JSX } from "solid-js";
import { formatCurrency } from "../../lib/format";
import { cn } from "../../lib/utils";
import { Money } from "./money";

type Status = "connected" | "syncing" | "error" | "disconnected";
type AccountRowProps = {
  icon: Component<{ class?: string; size?: number }>;
  name: string;
  sublabel?: string;
  balance: number;
  currency?: string;
  status?: Status;
  /** Extra content under the row, e.g. a credit utilisation bar. */
  footer?: JSX.Element;
  onClick?: () => void;
};

const statusLabel: Record<Status, string | null> = { connected: null, syncing: "Syncing…", error: "Sync failed", disconnected: "Disconnected" };
const statusColor: Record<Status, string> = { connected: "text-muted", syncing: "text-signal", error: "text-neg", disconnected: "text-muted" };

/** Account row: icon tile, name + sublabel, right-aligned mono balance (neg when below zero). */
export const AccountRow: Component<AccountRowProps> = (props) => {
  const content = (): JSX.Element => (
    <div class="py-2.5">
      <div class="flex items-center gap-3 min-h-[42px]">
        <div class="w-[38px] h-[38px] shrink-0 rounded-[10px] bg-raised flex items-center justify-center text-muted">
          {(() => { const Icon = props.icon; return <Icon size={18} />; })()}
        </div>
        <div class="flex-1 min-w-0">
          <div class="text-[14.5px] font-medium text-text truncate">{props.name}</div>
          {props.sublabel && <div class="text-[12.5px] text-muted mt-0.5 truncate">{props.sublabel}</div>}
        </div>
        <div class="text-right">
          <Money value={props.balance} currency={props.currency} tone={props.balance < 0 ? "neg" : "text"} class="text-[14.5px]" />
          <Show when={props.status && statusLabel[props.status]}>
            {(label) => <div class={cn("text-[12px] font-medium mt-0.5", statusColor[props.status!])}>{label()}</div>}
          </Show>
        </div>
      </div>
      {props.footer}
    </div>
  );
  if (props.onClick) {
    return (
      <button type="button" onClick={props.onClick}
        class="w-full text-left rounded-[12px] px-2 -mx-2 hover:bg-raised active:bg-raised transition-colors duration-[160ms] cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-signal"
        aria-label={`${props.name}, balance ${formatCurrency(props.balance, props.currency)}`}>
        {content()}
      </button>
    );
  }
  return content() as JSX.Element;
};
