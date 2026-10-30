import { createMemo, createResource, createSignal, Show } from "solid-js";
import { useNavigate } from "@solidjs/router";
import { api } from "../lib/api";
import { formatCurrency, pgDateToString, numericToFloat } from "../lib/format";
import { onDataChanged, onRowEdit, onRowMove } from "../lib/events";
import { PageHeader } from "../components/ui/page-header";
import { BentoBlock } from "../components/ui/bento-block";
import { SkeletonBlock } from "../components/ui/skeleton";
import { Sheet } from "../components/ui/sheet";
import { MonthPicker, currentMonth } from "../components/ui/month-picker";
import { NewTransactionButton } from "../components/shell/NewTransactionButton";
import { TransactionForm } from "../components/forms/transaction-form";
import { NetWorthCard } from "../components/dashboard/NetWorthCard";
import { CashflowCard } from "../components/dashboard/CashflowCard";
import { RecentActivityTable } from "../components/dashboard/RecentActivityTable";
import { BudgetsCard } from "../components/dashboard/BudgetsCard";
import { AccountsCard } from "../components/dashboard/AccountsCard";
import { AlertPills, type AlertItem } from "../components/dashboard/AlertPills";
import { MobileHome } from "../components/dashboard/MobileHome";
import {
  daysLeftInMonth, deriveNetWorth, lastMonths, snapshotSeries, toRow,
  type NetWorthData, type Row, type Snapshot, type Summary,
} from "../components/dashboard/data";

interface InsurancePolicy {
  id: string;
  name: string;
  renewal_date: unknown; // pgtype.Date
}

interface Loan {
  id: string;
  name: string;
  start_date: unknown;      // pgtype.Date
  emi_amount: unknown;      // pgtype.Numeric
  outstanding_balance: unknown; // pgtype.Numeric
}

interface FullTx {
  id: string;
  account_id: string;
  type: "income" | "expense" | "transfer";
  amount: string;
  currency: string;
  date: string;
  category_id: string | null;
  title: string;
  note: string;
  transfer_to_id?: string | null;
  tags?: { id: string; name: string; color: string }[];
}

function formatAlertDate(iso: string): string {
  try {
    return new Intl.DateTimeFormat("en-IN", { month: "short", day: "numeric" }).format(new Date(iso));
  } catch {
    return iso;
  }
}

/** Compute the next EMI due date for a loan given its start_date.
 *  Returns a YYYY-MM-DD string or null if indeterminate. */
function nextEmiDate(startDateRaw: unknown): string | null {
  const dateStr = pgDateToString(startDateRaw);
  if (!dateStr) return null;
  const start = new Date(dateStr + "T00:00:00Z");
  if (isNaN(start.getTime())) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const dayOfMonth = start.getUTCDate();
  // Find the next (or current) month's payment day
  let candidate = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), dayOfMonth));
  if (candidate < today) {
    candidate = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth() + 1, dayOfMonth));
  }
  return candidate.toISOString().slice(0, 10);
}

const MONTH_LONG = new Intl.DateTimeFormat("en-US", { month: "long" });

export default function Dashboard() {
  const navigate = useNavigate();
  const [month, setMonth] = createSignal(currentMonth());
  const [summary, { refetch }] = createResource(month, (m) => api.get<Summary>(`/v1/summary?month=${m}`));
  const [networth, { refetch: refetchNetworth }] = createResource(() =>
    api.get<NetWorthData>("/v1/networth").catch(() => null)
  );
  const [snapshots] = createResource(() =>
    api.get<Snapshot[]>("/v1/networth/snapshots").catch(() => [] as Snapshot[])
  );
  // Net worth history is "as of today". When another month is selected,
  // load the current month's cash flow so the estimate stays anchored to today.
  const [currentSummary] = createResource(
    () => (month() !== currentMonth() ? true : undefined),
    () => api.get<Summary>(`/v1/summary?month=${currentMonth()}`).catch(() => null),
  );
  const [insurance] = createResource(() =>
    api.get<InsurancePolicy[]>("/v1/insurance").catch(() => [] as InsurancePolicy[])
  );
  const [loans] = createResource(() =>
    api.get<Loan[]>("/v1/loans").catch(() => [] as Loan[])
  );

  onDataChanged(() => { refetch(); refetchNetworth(); });

  /** Build alert items from available data. Returns [] when nothing to alert. */
  const alerts = (): AlertItem[] => {
    const items: AlertItem[] = [];
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // ── 1. Budget ≥ 80% (warn at ≥ 90%) ─────────────────────────────────
    const budgets = [...(summary()?.budget_status ?? [])].sort((a, b) => b.spent_pct - a.spent_pct);
    for (const b of budgets) {
      if (b.spent_pct >= 80) {
        const left = b.amount - b.spent;
        items.push({
          key: `budget-${b.name}`,
          text: `${b.name} is at ${b.spent_pct}%`,
          meta: left >= 0 ? `${formatCurrency(left, b.currency)} left` : `${formatCurrency(-left, b.currency)} over`,
          level: b.spent_pct >= 90 ? "warn" : "signal",
        });
      }
    }

    // ── 2. Insurance renewals within 30 days ─────────────────────────────
    for (const p of insurance() ?? []) {
      const dateStr = pgDateToString(p.renewal_date);
      if (!dateStr) continue;
      const renewal = new Date(dateStr + "T00:00:00Z");
      if (isNaN(renewal.getTime())) continue;
      const diffDays = Math.floor((renewal.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
      if (diffDays >= 0 && diffDays <= 30) {
        items.push({ key: `insurance-${p.id}`, text: `${p.name} renews`, meta: formatAlertDate(dateStr), level: "signal" });
      }
    }

    // ── 3. Loans with EMI within 14 days ─────────────────────────────────
    for (const l of loans() ?? []) {
      const outstanding = numericToFloat(l.outstanding_balance);
      const emi = numericToFloat(l.emi_amount);
      if (outstanding <= 0 || emi <= 0) continue;
      const nextDate = nextEmiDate(l.start_date);
      if (!nextDate) continue;
      const due = new Date(nextDate + "T00:00:00Z");
      const diffDays = Math.floor((due.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
      if (diffDays >= 0 && diffDays <= 14) {
        items.push({ key: `loan-${l.id}`, text: `${l.name} EMI ${formatCurrency(emi)}`, meta: `due ${formatAlertDate(nextDate)}`, level: "signal" });
      }
    }

    return items;
  };

  const rows = createMemo<Row[]>(() => (summary()?.recent_transactions ?? []).map(toRow));
  const accounts = () => summary()?.account_balances ?? [];

  /** Today's net worth: the /networth figure, else the sum of account balances. */
  const nwValue = () => networth()?.networth ?? accounts().reduce((s, a) => s + a.balance, 0);

  const snapPoints = () => snapshotSeries(snapshots() ?? []);
  const estimated = () => snapPoints().length < 2;
  const nwPoints = () => {
    if (!estimated()) {
      // Pin the latest point to today's value so the chart ends where the number is.
      const pts = snapPoints();
      const cur = currentMonth();
      return pts[pts.length - 1]!.month === cur
        ? [...pts.slice(0, -1), { month: cur, value: nwValue() }]
        : [...pts, { month: cur, value: nwValue() }];
    }
    const flows = (month() === currentMonth() ? summary() : currentSummary())?.monthly_networth ?? [];
    return deriveNetWorth(nwValue(), flows, currentMonth(), 6);
  };
  const nwChangeThisMonth = () => {
    const pts = nwPoints();
    return pts.length >= 2 ? nwValue() - pts[pts.length - 2]!.value : null;
  };

  const flowMonths = () => lastMonths(summary()?.monthly_networth ?? [], month(), 6);

  // ── J / K selection, E / Enter to edit ─────────────────────────────────
  const [selected, setSelected] = createSignal(-1);
  onRowMove((d) => {
    const n = rows().length;
    if (n === 0) return;
    setSelected((i) => (i < 0 ? (d > 0 ? 0 : n - 1) : Math.max(0, Math.min(n - 1, i + d))));
    document.querySelector<HTMLElement>(`#recent-activity [role="row"][aria-selected="true"]`)?.focus();
  });
  onRowEdit(() => { const r = rows()[selected()]; if (r) openEdit(r); });

  const [editTx, setEditTx] = createSignal<FullTx | null>(null);
  async function openEdit(r: Row) {
    if (r.type === "transfer") { navigate("/activity"); return; }
    try {
      setEditTx(await api.get<FullTx>(`/v1/transactions/${r.id}`));
    } catch {
      navigate("/activity");
    }
  }
  const closeEdit = () => setEditTx(null);

  return (
    <>
      <PageHeader
        title="Overview"
        actions={
          <div class="flex items-center gap-2">
            <MonthPicker value={month()} onChange={(m) => { setMonth(m); setSelected(-1); }} />
            <NewTransactionButton />
          </div>
        }
      />

      <div class="px-5 md:px-7 pt-5 pb-6 flex flex-col gap-4">
        <Show when={summary.loading && !summary()}>
          <div class="grid grid-cols-1 md:grid-cols-[minmax(0,7fr)_minmax(0,5fr)] gap-4">
            <SkeletonBlock class="min-h-[280px]" />
            <SkeletonBlock class="min-h-[280px]" />
            <SkeletonBlock class="min-h-[320px]" />
            <SkeletonBlock class="min-h-[320px]" />
          </div>
        </Show>

        <Show when={summary.error}>
          <BentoBlock class="flex items-center justify-center py-16">
            <p class="text-neg">Failed to load summary.</p>
          </BentoBlock>
        </Show>

        <Show when={summary()}>
          {(s) => (
            <>
              {/* ── Mobile Home (03) ─────────────────────────────── */}
              <MobileHome
                networth={nwValue()}
                change={nwChangeThisMonth()}
                spark={nwPoints().map((p) => p.value)}
                income={s().total_income}
                expense={s().total_expenses}
                alerts={alerts()}
                accounts={accounts()}
                rows={rows()}
                onOpen={openEdit}
              />

              {/* ── Desktop Overview (01) ────────────────────────── */}
              <div class="hidden md:flex flex-col gap-4">
                <AlertPills alerts={alerts()} />
                <div class="grid grid-cols-1 lg:grid-cols-[minmax(0,7fr)_minmax(0,5fr)] gap-4 items-start">
                  <NetWorthCard value={nwValue()} points={nwPoints()} estimated={estimated()} />
                  <CashflowCard
                    monthLabel={MONTH_LONG.format(new Date(`${month()}-01T00:00:00`))}
                    income={s().total_income}
                    expense={s().total_expenses}
                    months={flowMonths()}
                  />
                  <div id="recent-activity" class="lg:row-span-2">
                    <RecentActivityTable rows={rows()} selected={selected()} onSelect={setSelected} onOpen={openEdit} />
                  </div>
                  <BudgetsCard budgets={s().budget_status ?? []} daysLeft={daysLeftInMonth(month())} />
                  <AccountsCard accounts={accounts()} />
                </div>
              </div>
            </>
          )}
        </Show>
      </div>

      <Sheet open={editTx() !== null} onClose={closeEdit} title="Edit transaction">
        <Show when={editTx()}>
          {(tx) => (
            <TransactionForm
              existing={{
                id: tx().id,
                type: tx().type,
                amount: tx().amount,
                currency: tx().currency,
                date: tx().date,
                account_id: tx().account_id,
                category_id: tx().category_id ?? undefined,
                title: tx().title,
                note: tx().note,
                transfer_to_id: tx().transfer_to_id ?? undefined,
                tags: tx().tags ?? [],
              }}
              onSuccess={() => { closeEdit(); refetch(); refetchNetworth(); }}
              onClose={closeEdit}
            />
          )}
        </Show>
      </Sheet>
    </>
  );
}
