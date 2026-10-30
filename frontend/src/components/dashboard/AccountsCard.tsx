import { For, Show, type Component } from "solid-js";
import { A } from "@solidjs/router";
import { Dynamic } from "solid-js/web";
import { Plus } from "lucide-solid";
import { BentoBlock } from "../ui/bento-block";
import { Eyebrow } from "../ui/eyebrow";
import { Money } from "../ui/money";
import { accountIcon, type AccountBalance } from "./data";

/** 01 · Accounts: 42px rows with a currency keycap and a right-aligned mono balance. */
export const AccountsCard: Component<{ accounts: AccountBalance[] }> = (props) => (
  <BentoBlock class="flex flex-col pt-3.5 px-2 pb-2">
    <div class="flex items-center justify-between px-3.5 pt-1 pb-2">
      <Eyebrow as="h2">Accounts</Eyebrow>
      <A href="/accounts" aria-label="Manage accounts" class="w-7 h-7 -mr-1.5 flex items-center justify-center rounded-[8px] !text-muted hover:!text-text hover:bg-raised transition-colors duration-[160ms]">
        <Plus size={15} />
      </A>
    </div>
    <Show when={props.accounts.length > 0} fallback={<p class="px-3.5 pb-3 text-[13.5px] text-muted">No accounts yet. <A href="/accounts">Add one</A>.</p>}>
      <ul>
        <For each={props.accounts.slice(0, 5)}>
          {(a) => (
            <li>
              <A href="/accounts" class="flex items-center gap-3 h-[42px] px-3.5 rounded-[10px] !text-text hover:bg-raised transition-colors duration-[160ms]">
                <Dynamic component={accountIcon(a.type)} size={16} class="text-muted w-[18px] shrink-0" />
                <span class="flex-1 min-w-0 truncate text-[13.5px] font-medium">{a.name}</span>
                <span class="font-mono font-medium text-[10.5px] px-[5px] py-[3px] rounded-[4px] bg-sunken text-muted">{a.currency}</span>
                <Money value={a.balance} currency={a.currency} tone={a.balance < 0 ? "neg" : "text"} class="min-w-[110px] text-right text-[13px] font-medium" />
              </A>
            </li>
          )}
        </For>
      </ul>
    </Show>
  </BentoBlock>
);
