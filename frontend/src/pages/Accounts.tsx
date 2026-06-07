import { createResource, For, Show } from "solid-js";
import { Plus, Landmark, Wallet, Banknote, PiggyBank, CreditCard, TrendingUp, Link2 } from "lucide-solid";
import { api } from "../lib/api";
import { formatCurrency } from "../lib/format";
import { PageHeader } from "../components/ui/page-header";
import { BentoBlock } from "../components/ui/bento-block";
import { AccountRow } from "../components/ui/account-row";
import { SkeletonBlock } from "../components/ui/skeleton";
import { EmptyState } from "../components/ui/empty-state";

interface Account { id: string; name: string; type: string; currency: string; balance: number; }

function accountIcon(type: string) {
  switch (type) {
    case "bank": return Landmark;
    case "wallet": return Wallet;
    case "cash": return Banknote;
    case "savings": return PiggyBank;
    case "credit_card": return CreditCard;
    case "investment": return TrendingUp;
    default: return Wallet;
  }
}

const typeLabel: Record<string, string> = {
  bank: "Bank", wallet: "Wallet", cash: "Cash", savings: "Savings",
  credit_card: "Credit Card", investment: "Investment",
};

export default function Accounts() {
  const [accounts] = createResource(() => api.get<Account[]>("/v1/accounts"));

  return (
    <>
      <PageHeader title="Accounts" actions={
        <button type="button" aria-label="Add account" class="w-10 h-10 flex items-center justify-center rounded-full bg-surface text-text active:scale-95 transition-transform focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-bg">
          <Plus size={20} />
        </button>
      } />
      <div class="p-4 md:p-6">
        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          <Show when={accounts.loading}>
            <SkeletonBlock class="min-h-[120px]" />
            <SkeletonBlock class="min-h-[120px]" />
          </Show>
          <Show when={!accounts.loading && accounts() && accounts()!.length === 0}>
            <div class="col-span-1 md:col-span-2 lg:col-span-3">
              <EmptyState icon={Wallet} title="No accounts yet" body="Add your first account to start tracking balances." action={{ label: "Add Account", onClick: () => {} }} />
            </div>
          </Show>
          <For each={accounts() ?? []}>
            {(a) => (
              <BentoBlock variant="default" size="sm">
                <AccountRow
                  icon={accountIcon(a.type)}
                  name={a.name}
                  sublabel={typeLabel[a.type] || a.type}
                  balance={a.balance}
                  currency={a.currency}
                />
              </BentoBlock>
            )}
          </For>
          <BentoBlock variant="dashed" size="sm" class="flex items-center justify-center">
            <button type="button" class="flex flex-col items-center gap-1 text-muted hover:text-text transition-colors">
              <Link2 size={20} />
              <span class="text-sm font-medium">Connect Institution</span>
            </button>
          </BentoBlock>
        </div>
      </div>
    </>
  );
}
