import { Show, type Component, type JSX } from "solid-js";
import { formatCurrency } from "../../lib/format";
import { cn } from "../../lib/utils";

type Status = "connected" | "syncing" | "error" | "disconnected";
type AccountRowProps = {
  icon: Component<{ class?: string; size?: number }>;
  name: string;
  sublabel?: string;
  balance: number;
  currency?: string;
  status?: Status;
  onClick?: () => void;
};

const statusLabel: Record<Status, string | null> = { connected: null, syncing: "Syncing…", error: "Sync failed", disconnected: "Disconnected" };
const statusColor: Record<Status, string> = { connected: "text-muted", syncing: "text-primary", error: "text-accent", disconnected: "text-muted" };

export const AccountRow: Component<AccountRowProps> = (props) => {
  const content = (): JSX.Element => (
    <div class="flex items-center gap-3 h-20">
      <div class="w-10 h-10 rounded-input bg-bg flex items-center justify-center text-muted">
        {(() => { const Icon = props.icon; return <Icon size={20} />; })()}
      </div>
      <div class="flex-1 min-w-0">
        <div class="font-body text-base text-text truncate">{props.name}</div>
        {props.sublabel && <div class="font-body text-[13px] text-muted mt-0.5 truncate">{props.sublabel}</div>}
      </div>
      <div class="text-right">
        <div class="font-display font-semibold text-lg text-text">{formatCurrency(props.balance, props.currency)}</div>
        <Show when={props.status && statusLabel[props.status]}>
          {(label) => <div class={cn("text-[12px] font-medium mt-0.5", statusColor[props.status!])}>{label()}</div>}
        </Show>
      </div>
    </div>
  );
  if (props.onClick) {
    return (
      <button type="button" onClick={props.onClick}
        class="w-full text-left active:bg-surface-hover transition-colors rounded-[16px] cursor-pointer"
        aria-label={`${props.name}, balance ${formatCurrency(props.balance, props.currency)}`}>
        {content()}
      </button>
    );
  }
  return content() as JSX.Element;
};
