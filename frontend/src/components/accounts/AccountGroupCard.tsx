import { For, Show, type Component } from "solid-js";
import { Dynamic } from "solid-js/web";
import { Pencil } from "lucide-solid";
import { Eyebrow } from "../ui/eyebrow";
import { Money } from "../ui/money";
import { ProgressBar } from "../ui/progress-bar";
import { formatCurrency } from "../../lib/format";
import { accountIcon, idOf, TYPE_LABEL, utilisation, type AccountGroup, type AccountBalance } from "./account-groups";

type Props = {
  group: AccountGroup;
  onOpen: (a: AccountBalance) => void;
  onEdit: (id: string) => void;
};

/** One account group: mono eyebrow, then a surface card of 14/16-padded rows. */
export const AccountGroupCard: Component<Props> = (props) => {
  const sublabel = (a: AccountBalance) => {
    if (props.group.key === "foreign") return `${a.currency} · ${TYPE_LABEL[a.type] ?? a.type}`;
    if (props.group.key === "credit") {
      const u = utilisation(a.balance, a.credit_limit);
      if (u !== null) return `${formatCurrency(Math.max(0, -a.balance), a.currency)} of ${formatCurrency(a.credit_limit!, a.currency)} · ${Math.round(u)}%`;
      return "No limit set";
    }
    return TYPE_LABEL[a.type] ?? a.type;
  };

  return (
    <section aria-labelledby={`acct-group-${props.group.key}`} class="flex flex-col">
      <div class="flex items-baseline justify-between pb-2.5">
        <Eyebrow as="h2">
          <span id={`acct-group-${props.group.key}`}>{props.group.label}</span>
        </Eyebrow>
        <span class="font-mono text-[11px] text-faint tabular">{props.group.accounts.length}</span>
      </div>
      <ul class="flex flex-col rounded-[16px] bg-surface border border-border overflow-hidden">
        <For each={props.group.accounts}>
          {(a) => {
            const id = idOf(a.id);
            const util = () => (props.group.key === "credit" ? utilisation(a.balance, a.credit_limit) : null);
            return (
              <li class="flex items-stretch border-b border-border last:border-b-0">
                <button
                  type="button"
                  onClick={() => props.onOpen(a)}
                  aria-label={`${a.name}, ${sublabel(a)}, balance ${formatCurrency(a.balance, a.currency)}. View activity`}
                  class="flex-1 min-w-0 text-left flex flex-col gap-2 pl-4 pr-2 py-3.5 hover:bg-raised active:bg-raised transition-colors duration-[160ms] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-signal"
                >
                  <div class="flex items-center gap-3">
                    <Dynamic component={accountIcon(a.type, props.group.key === "foreign")} size={17} class="text-muted w-[18px] shrink-0" />
                    <div class="flex-1 min-w-0">
                      <div class="text-[15px] font-medium text-text truncate">{a.name}</div>
                      <div class="text-[12px] text-muted mt-1 truncate">{sublabel(a)}</div>
                    </div>
                    <Money value={a.balance} currency={a.currency} tone={a.balance < 0 ? "neg" : "text"} class="text-[14.5px] font-medium" />
                  </div>
                  <Show when={util() !== null}>
                    <ProgressBar pct={util()!} tone="bg-neg" class="ml-[30px] w-auto h-1" label={`${a.name} credit utilisation`} />
                  </Show>
                </button>
                <button
                  type="button"
                  onClick={() => props.onEdit(id)}
                  aria-label={`Edit ${a.name}`}
                  class="w-10 shrink-0 flex items-center justify-center text-faint hover:text-text hover:bg-raised transition-colors duration-[160ms] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-signal"
                >
                  <Pencil size={14} />
                </button>
              </li>
            );
          }}
        </For>
      </ul>
    </section>
  );
};
