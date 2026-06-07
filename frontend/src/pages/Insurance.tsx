import { createResource, For, Show } from "solid-js";
import { Plus, ShieldCheck, Calendar } from "lucide-solid";
import { api } from "../lib/api";
import { formatCurrency } from "../lib/format";
import { PageHeader } from "../components/ui/page-header";
import { BentoBlock } from "../components/ui/bento-block";
import { Badge } from "../components/ui/badge";
import { SkeletonBlock } from "../components/ui/skeleton";
import { EmptyState } from "../components/ui/empty-state";

function numericToFloat(v: unknown): number {
  if (typeof v === "number") return v;
  if (typeof v === "string") return parseFloat(v) || 0;
  if (v && typeof v === "object" && "Int" in (v as any)) {
    const o = v as { Int: number; Exp: number; Valid: boolean };
    if (!o.Valid) return 0;
    return o.Int * Math.pow(10, o.Exp);
  }
  return 0;
}

function pgTextToString(v: unknown): string {
  if (typeof v === "string") return v;
  if (v && typeof v === "object" && "String" in (v as any)) {
    const o = v as { String: string; Valid: boolean };
    return o.Valid ? o.String : "";
  }
  return "";
}

function pgDateToString(v: unknown): string {
  if (typeof v === "string") return v.slice(0, 10);
  if (v && typeof v === "object" && "Time" in (v as any)) {
    const o = v as { Time: string; Valid: boolean };
    return o.Valid ? o.Time.slice(0, 10) : "—";
  }
  return "—";
}

interface Policy {
  id: string;
  name: string;
  provider: unknown;        // pgtype.Text
  policy_type: string;
  premium_amount: unknown;  // pgtype.Numeric
  premium_frequency: string;
  currency: string;
  renewal_date: unknown;    // pgtype.Date
  end_date: unknown;        // pgtype.Date
}

function renewalStatus(policy: Policy): "active" | "expiring" | "expired" {
  const renewal = pgDateToString(policy.end_date || policy.renewal_date);
  if (!renewal || renewal === "—") return "active";
  const days = (new Date(renewal).getTime() - Date.now()) / 86400000;
  if (days < 0) return "expired";
  if (days < 30) return "expiring";
  return "active";
}

export default function Insurance() {
  const [policies] = createResource(() => api.get<Policy[]>("/v1/insurance"));

  return (
    <>
      <PageHeader title="Insurance" actions={
        <button type="button" aria-label="Add policy" class="w-10 h-10 flex items-center justify-center rounded-full bg-surface text-text active:scale-95 transition-transform focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-bg">
          <Plus size={20} />
        </button>
      } />
      <div class="p-4 md:p-6">
        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          <Show when={policies.loading}>
            <SkeletonBlock class="min-h-[140px]" />
            <SkeletonBlock class="min-h-[140px]" />
          </Show>
          <Show when={policies.error}>
            <div class="col-span-1 md:col-span-2 lg:col-span-3">
              <p class="text-accent text-sm py-6 text-center">Failed to load policies.</p>
            </div>
          </Show>
          <Show when={!policies.loading && !policies.error && (policies() ?? []).length === 0}>
            <div class="col-span-1 md:col-span-2 lg:col-span-3">
              <EmptyState icon={ShieldCheck} title="No policies tracked" body="Track insurance policies and renewal dates." action={{ label: "Add policy", onClick: () => {} }} />
            </div>
          </Show>
          <For each={policies() ?? []}>
            {(p) => {
              const status = renewalStatus(p);
              const provider = pgTextToString(p.provider);
              const renewalDate = pgDateToString(p.renewal_date || p.end_date);
              return (
                <BentoBlock variant="pressable" size="md">
                  <div class="flex items-start gap-3">
                    <div class="w-10 h-10 rounded-input bg-bg flex items-center justify-center text-muted flex-shrink-0">
                      <ShieldCheck size={20} />
                    </div>
                    <div class="flex-1 min-w-0">
                      <div class="flex items-center gap-2 mb-1 flex-wrap">
                        <span class="font-display text-lg font-bold text-text">{p.name}</span>
                        <Show when={provider}>
                          <Badge variant="outline">{provider}</Badge>
                        </Show>
                        <Badge variant={status === "active" ? "success" : "destructive"}>
                          {status === "active" ? "Active" : status === "expiring" ? "Expiring soon" : "Expired"}
                        </Badge>
                      </div>
                      <div class="grid grid-cols-2 gap-3 mt-2">
                        <div>
                          <div class="text-[12px] text-muted uppercase tracking-wide">Premium</div>
                          <div class="font-display text-base font-semibold text-text">
                            {formatCurrency(numericToFloat(p.premium_amount), p.currency)}/{p.premium_frequency.slice(0, 2)}
                          </div>
                        </div>
                        <div>
                          <div class="flex items-center gap-1 text-[12px] text-muted uppercase tracking-wide"><Calendar size={12} /> Renews</div>
                          <div class="font-display text-base font-semibold text-text">{renewalDate}</div>
                        </div>
                      </div>
                    </div>
                  </div>
                </BentoBlock>
              );
            }}
          </For>
        </div>
      </div>
    </>
  );
}
