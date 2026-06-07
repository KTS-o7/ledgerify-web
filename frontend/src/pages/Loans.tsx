import { createResource, For, Show } from "solid-js";
import { Plus, Landmark, Calendar, TrendingDown } from "lucide-solid";
import { api } from "../lib/api";
import { formatCurrency } from "../lib/format";
import { PageHeader } from "../components/ui/page-header";
import { BentoBlock } from "../components/ui/bento-block";
import { Badge } from "../components/ui/badge";
import { SkeletonBlock } from "../components/ui/skeleton";
import { EmptyState } from "../components/ui/empty-state";

interface Loan { id: string; lender: string; type: string; principal: number; emi: number; next_due: string; }

export default function Loans() {
  const [loans] = createResource(() => api.get<Loan[]>("/v1/loans"));

  return (
    <>
      <PageHeader title="Loans" actions={
        <button type="button" aria-label="Add loan" class="w-10 h-10 flex items-center justify-center rounded-full bg-surface text-text active:scale-95 transition-transform focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-bg">
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
              <EmptyState icon={Landmark} title="No loans tracked" body="Track outstanding loans and EMI schedules." action={{ label: "Add loan", onClick: () => {} }} />
            </div>
          </Show>
          <For each={loans() ?? []}>
            {(l) => (
              <BentoBlock variant="pressable" size="md" onClick={() => { /* TODO */ }}>
                <div class="flex items-start gap-3">
                  <div class="w-10 h-10 rounded-input bg-bg flex items-center justify-center text-muted flex-shrink-0">
                    <Landmark size={20} />
                  </div>
                  <div class="flex-1 min-w-0">
                    <div class="flex items-center gap-2 mb-1">
                      <span class="font-display text-lg font-bold text-text">{l.lender}</span>
                      <Badge variant="outline">{l.type}</Badge>
                    </div>
                    <div class="grid grid-cols-3 gap-3 mt-2">
                      <div>
                        <div class="flex items-center gap-1 text-[12px] text-muted uppercase tracking-wide"><TrendingDown size={12} /> Principal</div>
                        <div class="font-display text-base font-semibold text-text">{formatCurrency(l.principal)}</div>
                      </div>
                      <div>
                        <div class="text-[12px] text-muted uppercase tracking-wide">EMI</div>
                        <div class="font-display text-base font-semibold text-text">{formatCurrency(l.emi)}</div>
                      </div>
                      <div>
                        <div class="flex items-center gap-1 text-[12px] text-muted uppercase tracking-wide"><Calendar size={12} /> Next due</div>
                        <div class="font-display text-base font-semibold text-text">{l.next_due}</div>
                      </div>
                    </div>
                  </div>
                </div>
              </BentoBlock>
            )}
          </For>
        </div>
      </div>
    </>
  );
}
