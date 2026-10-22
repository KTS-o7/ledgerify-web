import { createResource, createSignal, For, Show } from "solid-js";
import { Plus, Wallet } from "lucide-solid";
import { useNavigate } from "@solidjs/router";
import { api } from "../lib/api";
import { getCurrency } from "../lib/format";
import { useAuth } from "../lib/store";
import { onDataChanged } from "../lib/events";
import { PageHeader } from "../components/ui/page-header";
import { SkeletonBlock } from "../components/ui/skeleton";
import { EmptyState } from "../components/ui/empty-state";
import { Sheet } from "../components/ui/sheet";
import { Button } from "../components/ui/button";
import { NewTransactionButton } from "../components/shell/NewTransactionButton";
import { AccountForm } from "../components/forms/account-form";
import { AccountGroupCard } from "../components/accounts/AccountGroupCard";
import { compactMoney, groupAccounts, idOf, totalsByCurrency, type AccountBalance } from "../components/accounts/account-groups";

interface FullAccount {
  id: string;
  name: string;
  type: string;
  currency: string;
  credit_limit?: number | null;
  statement_day?: number | null;
  payment_due_day?: number | null;
}

export default function Accounts() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [accounts, { refetch }] = createResource(() => api.get<AccountBalance[]>("/v1/accounts"));
  const [sheetOpen, setSheetOpen] = createSignal(false);
  const [editAccount, setEditAccount] = createSignal<FullAccount | null>(null);
  const [deleting, setDeleting] = createSignal(false);

  onDataChanged(() => refetch());

  const baseCurrency = () => user()?.default_currency || getCurrency();
  const list = () => accounts() ?? [];
  const totals = () => totalsByCurrency(list(), baseCurrency());
  const groups = () => groupAccounts(list(), baseCurrency());

  function openSheet() { setSheetOpen(true); }
  function closeSheet() { setSheetOpen(false); }
  function closeEdit() { setEditAccount(null); }

  async function openEdit(id: string) {
    try {
      const full = await api.get<FullAccount>(`/v1/accounts/${id}`);
      setEditAccount(full);
    } catch {
      alert("Failed to load account.");
    }
  }

  async function handleDelete(id: string, name: string) {
    if (!confirm(`Delete "${name}"? All transactions linked to this account will be affected.`)) return;
    setDeleting(true);
    try {
      await api.delete(`/v1/accounts/${id}`);
      closeEdit();
      refetch();
    } catch {
      alert("Failed to delete account.");
    } finally {
      setDeleting(false);
    }
  }

  const openActivity = (a: AccountBalance) =>
    navigate(`/activity?account_id=${idOf(a.id)}&account_name=${encodeURIComponent(a.name)}`);

  return (
    <>
      <PageHeader
        title="Accounts"
        meta={<Show when={list().length > 0}>{list().length}</Show>}
        actions={
          <>
            <Button variant="outline" size="sm" class="hidden md:inline-flex h-9" onClick={openSheet}>
              <Plus size={15} />
              Add account
            </Button>
            <NewTransactionButton />
            <button
              type="button"
              aria-label="Add account"
              onClick={openSheet}
              class="md:hidden w-9 h-9 flex items-center justify-center rounded-full border border-border-strong text-text active:scale-[0.96] transition-transform duration-[90ms] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-signal"
            >
              <Plus size={18} />
            </button>
          </>
        }
      />

      <div class="px-5 md:px-7 py-5 md:py-6 flex flex-col gap-[18px] md:gap-4 max-w-[1100px]">
        <Show when={accounts.loading && !accounts()}>
          <div class="grid grid-cols-3 gap-2">
            <SkeletonBlock class="h-[62px] rounded-[14px]" />
            <SkeletonBlock class="h-[62px] rounded-[14px]" />
            <SkeletonBlock class="h-[62px] rounded-[14px]" />
          </div>
          <SkeletonBlock class="h-[180px]" />
          <SkeletonBlock class="h-[120px]" />
        </Show>

        <Show when={accounts.error}>
          <p class="text-neg text-[14px]" role="alert">Failed to load accounts.</p>
        </Show>

        <Show when={accounts() && list().length === 0}>
          <EmptyState
            icon={Wallet}
            title="No accounts yet"
            body="Add your first account to start tracking balances."
            action={{ label: "Add account", onClick: openSheet }}
          />
        </Show>

        <Show when={list().length > 0}>
          {/* Totals per currency */}
          <section aria-label="Totals by currency" class="grid grid-cols-3 md:grid-cols-[repeat(auto-fill,minmax(160px,1fr))] gap-2">
            <For each={totals()}>
              {(t) => (
                <div class="flex flex-col gap-[7px] p-3 rounded-[14px] bg-surface border border-border min-w-0">
                  <span class="font-mono font-medium text-[10.5px] text-muted leading-none">{t.currency}</span>
                  <span class={`font-mono font-medium text-[14px] md:text-[17px] leading-none tracking-[-0.03em] tabular truncate ${t.total < 0 ? "text-neg" : "text-text"}`}>
                    {compactMoney(t.total, t.currency)}
                  </span>
                </div>
              )}
            </For>
          </section>

          {/* Groups: one column on mobile, two on desktop */}
          <div class="grid grid-cols-1 lg:grid-cols-2 gap-[18px] md:gap-4 items-start">
            <For each={groups()}>
              {(g) => <AccountGroupCard group={g} onOpen={openActivity} onEdit={openEdit} />}
            </For>
          </div>
        </Show>
      </div>

      <Sheet open={sheetOpen()} onClose={closeSheet} title="Add account">
        <AccountForm onSuccess={() => { closeSheet(); refetch(); }} onClose={closeSheet} />
      </Sheet>

      <Sheet open={editAccount() !== null} onClose={closeEdit} title="Edit account">
        <Show when={editAccount()}>
          {(acct) => {
            const accountId = idOf(acct().id);
            return (
              <div class="flex flex-col gap-3">
                <AccountForm
                  existing={{
                    id: accountId,
                    name: acct().name,
                    type: acct().type,
                    currency: acct().currency,
                    credit_limit: acct().credit_limit,
                    statement_day: acct().statement_day,
                    payment_due_day: acct().payment_due_day,
                  }}
                  onSuccess={() => { closeEdit(); refetch(); }}
                  onClose={closeEdit}
                />
                <Button
                  variant="ghost"
                  class="w-full text-neg hover:text-neg"
                  disabled={deleting()}
                  onClick={() => handleDelete(accountId, acct().name)}
                >
                  {deleting() ? "Deleting…" : "Delete account"}
                </Button>
              </div>
            );
          }}
        </Show>
      </Sheet>
    </>
  );
}
