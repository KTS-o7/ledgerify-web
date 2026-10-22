import { For, Show, type Component } from "solid-js";
import { A } from "@solidjs/router";
import { Repeat } from "lucide-solid";
import { BentoBlock } from "../ui/bento-block";
import { Eyebrow } from "../ui/eyebrow";
import { Money } from "../ui/money";
import { Kbd } from "../ui/kbd";
import { formatDate } from "../../lib/format";
import { cn } from "../../lib/utils";
import { categoryColor, type Row } from "./data";

type Props = {
  rows: Row[];
  selected: number;
  onSelect: (i: number) => void;
  onOpen: (row: Row) => void;
};

const cols = "grid grid-cols-[64px_minmax(0,1.6fr)_minmax(0,1fr)_minmax(0,1fr)_120px] gap-3 px-5";

/** 01 · Recent activity: dense 44px table with J/K selection and E to edit. */
export const RecentActivityTable: Component<Props> = (props) => (
  <BentoBlock class="p-0 overflow-hidden flex flex-col">
    <div class="flex items-center gap-2.5 px-5 pt-4 pb-3">
      <Eyebrow as="h2" class="flex-1">Recent activity</Eyebrow>
      <span class="hidden lg:flex items-center gap-1 text-[12.5px] text-muted" aria-hidden="true">
        <Kbd>J</Kbd><Kbd>K</Kbd> to move · <Kbd>E</Kbd> edit
      </span>
      <A href="/activity" class="text-[12.5px] font-medium ml-2">View all</A>
    </div>
    <Show when={props.rows.length > 0} fallback={<p class="text-muted text-[13.5px] py-10 text-center border-t border-border">No transactions this month yet.</p>}>
      <div role="grid" aria-label="Recent activity" aria-rowcount={props.rows.length}>
        <div role="row" class={cn(cols, "py-2 border-y border-border font-mono font-medium text-[10.5px] uppercase tracking-[0.08em] text-muted")}>
          <span role="columnheader">Date</span>
          <span role="columnheader">Merchant</span>
          <span role="columnheader">Category</span>
          <span role="columnheader">Account</span>
          <span role="columnheader" class="text-right">Amount</span>
        </div>
        <For each={props.rows}>
          {(r, i) => (
            <div
              role="row"
              tabindex={props.selected === i() ? 0 : -1}
              aria-selected={props.selected === i()}
              onClick={() => props.onSelect(i())}
              onDblClick={() => props.onOpen(r)}
              onKeyDown={(e) => { if (e.key === "Enter") props.onOpen(r); }}
              class={cn(cols, "items-center h-11 border-b border-border last:border-b-0 text-[13.5px] cursor-pointer transition-colors duration-[160ms] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-signal",
                props.selected === i() ? "bg-signal-soft" : "hover:bg-raised")}
            >
              <span role="gridcell" class="font-mono tabular text-[12px] text-muted">{formatDate(r.date)}</span>
              <span role="gridcell" class="flex items-center gap-2 min-w-0">
                <span class="truncate text-text">{r.title}</span>
                <Show when={r.recurring}><Repeat size={12} class="shrink-0 text-muted" aria-label="Recurring" /></Show>
              </span>
              <span role="gridcell" class="flex items-center gap-[7px] text-muted min-w-0">
                <span class="w-[7px] h-[7px] rounded-[2px] shrink-0" style={{ background: categoryColor(r.categoryKey) }} aria-hidden="true" />
                <span class="truncate">{r.category}</span>
              </span>
              <span role="gridcell" class="text-muted truncate">{r.account}</span>
              <span role="gridcell" class={cn("text-right font-mono tabular text-[13px] font-medium", r.type === "income" ? "text-pos" : r.type === "transfer" ? "text-muted" : "text-text")}>
                {r.type === "income" ? "+" : r.type === "expense" ? "−" : ""}
                <Money value={r.amount} currency={r.currency} tone={r.type === "income" ? "pos" : r.type === "transfer" ? "muted" : "text"} />
              </span>
            </div>
          )}
        </For>
      </div>
    </Show>
  </BentoBlock>
);
