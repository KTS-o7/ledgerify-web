import { createResource, createSignal, For, Show } from "solid-js";
import { Plus, Landmark, Calendar, TrendingDown, Pencil, Trash2 } from "lucide-solid";
import { api } from "../lib/api";
import { formatCurrency, numericToFloat } from "../lib/format";
import { PageHeader } from "../components/ui/page-header";
import { BentoBlock } from "../components/ui/bento-block";
import { Badge } from "../components/ui/badge";
import { SkeletonBlock } from "../components/ui/skeleton";
import { EmptyState } from "../components/ui/empty-state";
import { Sheet } from "../components/ui/sheet";
import { LoanForm } from "../components/forms/loan-form";

interface Loan {
  id: string;
  name: string;
  loan_type: string;
  principal: unknown;           // pgtype.Numeric
  emi_amount: unknown;          // pgtype.Numeric
  outstanding_balance: unknown; // pgtype.Numeric
  currency: string;
  start_date: unknown;          // pgtype.Date
  tenure_months: number;
  interest_rate: unknown;       // pgtype.Numeric
  computed_emi: unknown;        // pgtype.Numeric
}

export default function Loans() {
  const [loans, { refetch }] = createResource(() => api.get<Loan[]>("/v1/loans"));
  const [sheetOpen, setSheetOpen] = createSignal(false);
  const [editLoan, setEditLoan] = createSignal<Loan | null>(null);
  const [editSheetOpen, setEditSheetOpen] = createSignal(false);

  function handleSuccess() {
    setSheetOpen(false);
    refetch();
  }
  function closeEdit() {
    setEditSheetOpen(false);
    setEditLoan(null);
  }
  function handleEditSuccess() {
    closeEdit();
    refetch();
  }

  async function handleDelete(id: string, name: string) {
    if (!confirm(`Delete "${name}"?`)) return;
    try {
      await api.delete(`/v1/loans/${id}`);
      refetch();
    } catch {
      alert("Failed to delete loan.");
    }
  }

  return (
    <>
      <PageHeader title="Loans" actions={
        <button
          type="button"
          aria-label="Add loan"
          onClick={() => setSheetOpen(true)}
          class="w-10 h-10 flex items-center justify-center rounded-full bg-surface text-text active:scale-95 transition-transform focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-bg"
        >
          <Plus size={20} />
        </button>
      } />
      <div class="p-4 md:p-6">
        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          <Show when={loans.loading}>
            <SkeletonBlock class="min-h-[140px]" />
            <SkeletonBlock class="min-h-[140px]" />
          </Show>
          <Show when={loans.error}>
            <div class="col-span-1 md:col-span-2 lg:col-span-3">
              <p class="text-accent text-sm py-6 text-center">Failed to load loans.</p>
            </div>
          </Show>
          <Show when={!loans.loading && !loans.error && (loans() ?? []).length === 0}>
            <div class="col-span-1 md:col-span-2 lg:col-span-3">
              <EmptyState
                icon={Landmark}
                title="No loans tracked"
                body="Track outstanding loans and EMI schedules."
                action={{ label: "Add loan", onClick: () => setSheetOpen(true) }}
              />
            </div>
          </Show>
          <For each={loans() ?? []}>
            {(l) => {
              const rate = numericToFloat(l.interest_rate);
              const computed = numericToFloat(l.computed_emi);
              return (
                <div class="group relative">
                  <BentoBlock variant="pressable">
                    <div class="flex items-start gap-3">
                      <div class="w-10 h-10 rounded-input bg-bg flex items-center justify-center text-muted flex-shrink-0">
                        <Landmark size={20} />
                      </div>
                      <div class="flex-1 min-w-0">
                        <div class="flex items-center gap-2 mb-1">
                          <span class="font-display text-lg font-bold text-text truncate">{l.name}</span>
                          <Badge variant="outline">{l.loan_type.replace("_", " ")}</Badge>
                          <Show when={rate > 0}>
                            <Badge variant="outline" class="font-mono">{rate.toFixed(2)}%</Badge>
                          </Show>
                        </div>
                        <div class="grid grid-cols-3 gap-2 mt-2">
                          <div>
                            <div class="flex items-center gap-1 text-[12px] text-muted uppercase tracking-wide"><TrendingDown size={12} /> Principal</div>
                            <div class="font-display text-sm font-semibold text-text">{formatCurrency(numericToFloat(l.principal), l.currency)}</div>
                          </div>
                          <div>
                            <div class="text-[12px] text-muted uppercase tracking-wide">EMI</div>
                            <div class="font-display text-sm font-semibold text-text">{formatCurrency(numericToFloat(l.emi_amount), l.currency)}</div>
                            <Show when={computed > 0}>
                              <div class="font-mono text-[11px] text-muted">computed: {formatCurrency(computed, l.currency)}</div>
                            </Show>
                          </div>
                          <div>
                            <div class="flex items-center gap-1 text-[12px] text-muted uppercase tracking-wide"><Calendar size={12} /> Outstanding</div>
                            <div class="font-display text-sm font-semibold text-text">{formatCurrency(numericToFloat(l.outstanding_balance), l.currency)}</div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </BentoBlock>
                  <div class="absolute top-3 right-3 flex gap-1 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity">
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); setEditLoan(l); setEditSheetOpen(true); }}
                      aria-label={`Edit ${l.name}`}
                      class="w-8 h-8 flex items-center justify-center rounded-lg bg-surface-hover text-muted hover:text-text transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-bg"
                    >
                      <Pencil size={14} />
                    </button>
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); handleDelete(l.id, l.name); }}
                      aria-label={`Delete ${l.name}`}
                      class="w-8 h-8 flex items-center justify-center rounded-lg bg-surface-hover text-muted hover:text-accent transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-bg"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              );
            }}
          </For>
        </div>
      </div>

      <Sheet open={sheetOpen()} onClose={() => setSheetOpen(false)} title="Add Loan">
        <LoanForm onSuccess={handleSuccess} onClose={() => setSheetOpen(false)} />
      </Sheet>

      <Sheet open={editSheetOpen()} onClose={closeEdit} title="Edit Loan">
        <Show when={editLoan()}>
          {(l) => (
            <LoanForm
              existing={{
                id: l().id,
                name: l().name,
                loan_type: l().loan_type,
                currency: l().currency,
                principal: l().principal,
                interest_rate: l().interest_rate,
                term_months: l().tenure_months,
                emi_amount: l().emi_amount,
                outstanding_balance: l().outstanding_balance,
                start_date: l().start_date,
              }}
              onSuccess={handleEditSuccess}
              onClose={closeEdit}
            />
          )}
        </Show>
      </Sheet>
    </>
  );
}
