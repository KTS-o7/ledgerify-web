import { createResource, For, Show } from "solid-js";
import { Plus, ShieldCheck, Calendar } from "lucide-solid";
import { api } from "../lib/api";
import { formatCurrency } from "../lib/format";
import { PageHeader } from "../components/ui/page-header";
import { BentoBlock } from "../components/ui/bento-block";
import { Badge } from "../components/ui/badge";
import { SkeletonBlock } from "../components/ui/skeleton";
import { EmptyState } from "../components/ui/empty-state";

interface Policy { id: string; provider: string; type: string; premium: number; renewal_date: string; status: "active" | "expiring" | "expired"; }

const SAMPLE_POLICIES: Policy[] = [
  { id: "1", provider: "HDFC Life", type: "Term Life", premium: 12000, renewal_date: "2026-09-15", status: "active" },
  { id: "2", provider: "ICICI Lombard", type: "Health", premium: 8500, renewal_date: "2026-07-08", status: "expiring" },
];

export default function Insurance() {
  const [policies] = createResource(() => api.get<Policy[]>("/v1/insurance").catch(() => SAMPLE_POLICIES));

  return (
    <>
      <PageHeader title="Insurance" actions={
        <button type="button" aria-label="Add policy" class="w-10 h-10 flex items-center justify-center rounded-full bg-surface text-text active:scale-95 transition-transform">
          <Plus size={20} />
        </button>
      } />
      <div class="p-4 md:p-6">
        <div class="grid grid-cols-1 md:grid-cols-2 gap-3 max-w-4xl">
          <Show when={policies.loading}>
            <SkeletonBlock class="min-h-[140px]" />
            <SkeletonBlock class="min-h-[140px]" />
          </Show>
          <Show when={!policies.loading && (policies() ?? []).length === 0}>
            <div class="col-span-1 md:col-span-2">
              <EmptyState icon={ShieldCheck} title="No policies tracked" body="Track insurance policies and renewal dates." action={{ label: "Add policy", onClick: () => {} }} />
            </div>
          </Show>
          <For each={policies() ?? []}>
            {(p) => (
              <BentoBlock variant="pressable" size="md" onClick={() => { /* TODO */ }}>
                <div class="flex items-start gap-3">
                  <div class="w-10 h-10 rounded-input bg-bg flex items-center justify-center text-muted flex-shrink-0">
                    <ShieldCheck size={20} />
                  </div>
                  <div class="flex-1 min-w-0">
                    <div class="flex items-center gap-2 mb-1 flex-wrap">
                      <span class="font-display text-lg font-bold text-text">{p.provider}</span>
                      <Badge variant="outline">{p.type}</Badge>
                      <Badge variant={p.status === "active" ? "success" : "destructive"}>
                        {p.status === "active" ? "Active" : p.status === "expiring" ? "Expiring soon" : "Expired"}
                      </Badge>
                    </div>
                    <div class="grid grid-cols-2 gap-3 mt-2">
                      <div>
                        <div class="text-[12px] text-muted uppercase tracking-wide">Premium</div>
                        <div class="font-display text-base font-semibold text-text">{formatCurrency(p.premium)}/yr</div>
                      </div>
                      <div>
                        <div class="flex items-center gap-1 text-[12px] text-muted uppercase tracking-wide"><Calendar size={12} /> Renews</div>
                        <div class="font-display text-base font-semibold text-text">{p.renewal_date}</div>
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
